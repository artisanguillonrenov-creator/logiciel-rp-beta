"""Serveur d'images Elyndor Cloud (Big Lust 1.6, SDXL).

Contrat attendu par l'app (src/engine/elyndorCloudImages.ts) :
POST /v1/images/generations
  {model, prompt, negative_prompt?, size: "1344x768", aspect_ratio, n, response_format: "b64_json",
   reference_images?: [data URLs], prompt_sdxl?: str}
→ {created, data: [{b64_json}]}

`prompt_sdxl` (anglais, court, rédigé par le modèle narratif) est
prioritaire : le CLIP de SDXL est limité à 77 jetons et comprend mal le
français. Sinon le prompt complet est encodé par morceaux via compel.

`reference_images` : [{role: "personnage"|"scene"|"race", image: data URL}] (une
chaîne seule vaut « personnage »). Deux IP-Adapter SDXL les exploitent :
« plus-face » pour le visage du personnage principal, « plus » à faible poids
pour la continuité du décor, de la lumière et de l'ambiance.

POST /v1/embeddings (contrat OpenAI) : bge-m3 sur le CPU du pod, vecteurs
normalisés de 1024 dimensions pour l'index HNSW ObjectBox de l'app. Le CPU
laisse la mémoire vidéo à Anubis et à SDXL.
"""
import base64, ctypes, gc, hashlib, io, os, pathlib, sqlite3, threading, time

import numpy as np
from PIL import Image

import torch
from compel import Compel, ReturnedEmbeddingsType
from diffusers import EulerAncestralDiscreteScheduler, StableDiffusionXLPipeline
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

# Tout est sur le volume réseau (/workspace), conservé quand le pod s'arrête.
RACINE = os.environ.get("ELYNDOR_ROOT", "/workspace/elyndor")
# Horodatage de la dernière requête : lu par watchdog.sh pour arrêter le pod inactif.
ACTIVITE = pathlib.Path(os.environ.get("ELYNDOR_ACTIVITE", "/tmp/elyndor-activite"))
# Big Lust 1.6 (dérivé de Lustify) : choisi au comparatif du 6 octobre, il garde
# le niveau explicite de Lustify tout en respectant mieux les personnages
# (peau ébène et oreilles des Elfes Noirs, scènes à deux). Lustify reste sur
# le volume (models/image/lustify-v4) pour revenir en arrière via ELYNDOR_IMAGE_DIR.
MODELE_DIR = os.environ.get("ELYNDOR_IMAGE_DIR", os.path.join(RACINE, "models/image/big-lust-v16"))
MODELE_ID = os.environ.get("ELYNDOR_IMAGE_MODELE", "big-lust-v16")
PAS = int(os.environ.get("ELYNDOR_IMAGE_STEPS", "30"))
GUIDANCE = float(os.environ.get("ELYNDOR_IMAGE_CFG", "5.5"))
EMBEDDINGS_DIR = os.environ.get("ELYNDOR_EMBEDDINGS_DIR", os.path.join(RACINE, "models/bge-m3"))
EMBEDDINGS_ID = os.environ.get("ELYNDOR_EMBEDDINGS_MODELE", "bge-m3")
IP_ADAPTER_DIR = os.environ.get("ELYNDOR_IP_ADAPTER_DIR", os.path.join(RACINE, "models/ip-adapter"))
POIDS_VISAGE = float(os.environ.get("ELYNDOR_IP_VISAGE", "0.6"))
POIDS_SCENE = float(os.environ.get("ELYNDOR_IP_SCENE", "0.3"))
# Portrait prédéfini de la race : allure (peau, cheveux, parure), pas le visage.
POIDS_RACE = float(os.environ.get("ELYNDOR_IP_RACE", "0.5"))
NEGATIF_BASE = "text, logo, watermark, signature, duplicate, extra limbs, extra fingers, deformed hands, deformed face, bad anatomy, blurry, lowres, child, minor, underage"

pipe = StableDiffusionXLPipeline.from_pretrained(MODELE_DIR, torch_dtype=torch.float16, use_safetensors=True)
# DPM++ Karras plante avec la config de ce checkpoint (IndexError sur sigmas) :
# Euler a, recommandé aussi pour Lustify, est stable.
pipe.scheduler = EulerAncestralDiscreteScheduler.from_config(pipe.scheduler.config)
# Ordre des adaptateurs : [scène (général), visage]. Chargés avant le
# déchargement CPU pour que l'encodeur d'image soit géré comme le reste.
IP_ADAPTER = os.path.isdir(os.path.join(IP_ADAPTER_DIR, "sdxl_models"))
if IP_ADAPTER:
    pipe.load_ip_adapter(
        IP_ADAPTER_DIR,
        subfolder="sdxl_models",
        weight_name=["ip-adapter-plus_sdxl_vit-h.safetensors", "ip-adapter-plus-face_sdxl_vit-h.safetensors"],
        image_encoder_folder="models/image_encoder",
        torch_dtype=torch.float16,
    )
VIDE = Image.new("RGB", (224, 224))

# Embeddings : chargés à part, pour qu'un échec ne bloque jamais les images.
encodeur = None
try:
    if os.path.isdir(EMBEDDINGS_DIR):
        from sentence_transformers import SentenceTransformer
        torch.set_num_threads(int(os.environ.get("ELYNDOR_EMBEDDINGS_THREADS", "24")))
        encodeur = SentenceTransformer(EMBEDDINGS_DIR, device="cpu")
        encodeur.max_seq_length = 512
except Exception as erreur:  # le service d'images reste disponible
    print("embeddings indisponibles :", erreur)
verrou_embeddings = threading.Lock()
# Cache persistant (volume réseau) : le lore Elyndor (~265 entrées) coûte
# 2 à 3 minutes de CPU ; un texte déjà vu revient instantanément, même si
# l'app a perdu son propre cache.
os.makedirs(os.path.join(RACINE, "cache"), exist_ok=True)
cache_embeddings = sqlite3.connect(os.path.join(RACINE, "cache", f"embeddings-{EMBEDDINGS_ID}.sqlite"), check_same_thread=False)
cache_embeddings.execute("CREATE TABLE IF NOT EXISTS vecteurs (cle TEXT PRIMARY KEY, vecteur BLOB NOT NULL)")
# Anubis occupe l'essentiel du GPU : chaque sous-modèle (encodeurs, UNet, VAE)
# n'est monté en mémoire vidéo que pendant son passage, puis rendu au CPU.
pipe.enable_model_cpu_offload()
pipe.vae.enable_tiling()
compel = Compel(
    tokenizer=[pipe.tokenizer, pipe.tokenizer_2],
    text_encoder=[pipe.text_encoder, pipe.text_encoder_2],
    returned_embeddings_type=ReturnedEmbeddingsType.PENULTIMATE_HIDDEN_STATES_NON_NORMALIZED,
    requires_pooled=[False, True],
    truncate_long_prompts=False,
    # Avec le déchargement CPU, les encodeurs « vivent » sur le CPU : les
    # jetons doivent quand même partir sur le GPU où les hooks les exécutent.
    device="cuda",
)
verrou = threading.Lock()

try:
    _libc = ctypes.CDLL("libc.so.6")
except OSError:
    _libc = None


def rendre_memoire() -> None:
    """Rend au système la mémoire libérée après une génération.

    Avec le déchargement CPU, chaque image fait transiter UNet, VAE et
    encodeurs entre CPU et GPU : la mémoire libérée restait réservée par
    l'allocateur (~10 Go de plus par image), jusqu'à la limite de 50 Go du
    pod, où le serveur était tué (erreur 502 dans l'app).
    """
    gc.collect()
    if torch.cuda.is_available():
        torch.cuda.empty_cache()
    if _libc is not None:
        _libc.malloc_trim(0)
app = FastAPI()
# La version web d'Elyndor (GitHub Pages) appelle ce serveur depuis le
# navigateur : sans en-têtes CORS, la requête serait bloquée.
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["GET", "POST", "OPTIONS"], allow_headers=["*"])


@app.middleware("http")
async def noter_activite(requete, suivant):
    if requete.url.path != "/health":
        ACTIVITE.touch()
    return await suivant(requete)


class Requete(BaseModel):
    model: str | None = None
    prompt: str
    prompt_sdxl: str | None = None
    negative_prompt: str | None = None
    size: str = "1344x768"
    aspect_ratio: str | None = None
    n: int = 1
    response_format: str = "b64_json"
    reference_images: list[str | dict] | None = None
    seed: int | None = None
    poids_race: float | None = None


def dimensions(taille: str) -> tuple[int, int]:
    try:
        l, h = (int(x) for x in taille.lower().split("x"))
    except ValueError:
        raise HTTPException(400, "size invalide, attendu LxH")
    if not (512 <= l <= 1536 and 512 <= h <= 1536):
        raise HTTPException(400, "size hors limites (512-1536)")
    return l - l % 8, h - h % 8


def lire_image(data_url: str) -> Image.Image | None:
    try:
        brut = data_url.split(",", 1)[1] if data_url.startswith("data:") else data_url
        return Image.open(io.BytesIO(base64.b64decode(brut))).convert("RGB")
    except Exception:
        return None


def references(req: "Requete") -> tuple[Image.Image | None, Image.Image | None, Image.Image | None]:
    """Première référence de personnage (visage), de scène et de race."""
    visage = scene = race = None
    for ref in req.reference_images or []:
        role, image = ("personnage", ref) if isinstance(ref, str) else (ref.get("role"), ref.get("image", ""))
        if not isinstance(image, str):
            continue
        if role == "scene" and scene is None:
            scene = lire_image(image)
        elif role == "race" and race is None:
            race = lire_image(image)
        elif role != "scene" and visage is None:
            visage = lire_image(image)
    return visage, scene, race


def egaliser_longueurs(a: torch.Tensor, b: torch.Tensor) -> tuple[torch.Tensor, torch.Tensor]:
    """Complète le conditionnement le plus court par des blocs de 77 jetons vides.

    Remplace compel.pad_conditioning_tensors_to_same_length, qui plante en
    2.4 avec les deux encodeurs de SDXL (« no attribute empty_z ») dès qu'un
    prompt dépasse 77 jetons.
    """
    if a.shape[1] == b.shape[1]:
        return a, b
    vide, _ = compel("")
    vide = vide.to(a.device, a.dtype)

    def completer(t: torch.Tensor, longueur: int) -> torch.Tensor:
        while t.shape[1] < longueur:
            t = torch.cat([t, vide[:, : longueur - t.shape[1]]], dim=1)
        return t

    longueur = max(a.shape[1], b.shape[1])
    return completer(a, longueur), completer(b, longueur)


@app.get("/v1/models")
def modeles():
    donnees = [{"id": MODELE_ID, "object": "model"}]
    if encodeur is not None:
        donnees.append({"id": EMBEDDINGS_ID, "object": "model"})
    return {"object": "list", "data": donnees}


class RequeteEmbeddings(BaseModel):
    model: str | None = None
    input: str | list[str]


@app.post("/v1/embeddings")
def embeddings(req: RequeteEmbeddings):
    if encodeur is None:
        raise HTTPException(503, "embeddings indisponibles")
    textes = [req.input] if isinstance(req.input, str) else req.input
    if not textes or len(textes) > 256:
        raise HTTPException(400, "input : 1 à 256 textes")
    cles = [hashlib.sha256(t.encode("utf-8")).hexdigest() for t in textes]
    with verrou_embeddings:
        connus = dict(cache_embeddings.execute(
            f"SELECT cle, vecteur FROM vecteurs WHERE cle IN ({','.join('?' * len(cles))})", cles).fetchall())
        a_calculer = sorted({c: t for c, t in zip(cles, textes) if c not in connus}.items())
        if a_calculer:
            calcules = encodeur.encode([t for _, t in a_calculer], batch_size=16, normalize_embeddings=True, convert_to_numpy=True)
            nouveaux = {c: v.astype(np.float32).tobytes() for (c, _), v in zip(a_calculer, calcules)}
            cache_embeddings.executemany("INSERT OR REPLACE INTO vecteurs VALUES (?, ?)", nouveaux.items())
            cache_embeddings.commit()
            connus.update(nouveaux)
    return {
        "object": "list",
        "model": EMBEDDINGS_ID,
        "data": [{"object": "embedding", "index": i, "embedding": np.frombuffer(connus[c], dtype=np.float32).tolist()}
                 for i, c in enumerate(cles)],
    }


@app.get("/health")
def sante():
    return {"status": "ok", "ip_adapter": IP_ADAPTER, "embeddings": encodeur is not None}


@app.post("/v1/images/generations")
def generer(req: Requete):
    largeur, hauteur = dimensions(req.size)
    positif = (req.prompt_sdxl or req.prompt).strip()
    negatif = ", ".join(x for x in [req.negative_prompt, NEGATIF_BASE] if x)
    with verrou:
        try:
            cond, pooled = compel(positif)
            ncond, npooled = compel(negatif)
            cond, ncond = egaliser_longueurs(cond, ncond)
            graine = req.seed if req.seed is not None else int(time.time() * 1000) % 2**31
            options = {}
            if IP_ADAPTER:
                visage, scene, race = references(req)
                # L'adaptateur général sert la scène précédente, ou à défaut le
                # portrait de race (portraits de PNJ, qui n'ont pas de scène).
                general = scene or race
                poids_race = req.poids_race if req.poids_race is not None else POIDS_RACE
                poids_general = POIDS_SCENE if scene else poids_race if race else 0.0
                pipe.set_ip_adapter_scale([poids_general, POIDS_VISAGE if visage else 0.0])
                options["ip_adapter_image"] = [general or VIDE, visage or VIDE]
            image = pipe(
                prompt_embeds=cond, pooled_prompt_embeds=pooled,
                negative_prompt_embeds=ncond, negative_pooled_prompt_embeds=npooled,
                width=largeur, height=hauteur, num_inference_steps=PAS, guidance_scale=GUIDANCE,
                generator=torch.Generator("cuda").manual_seed(graine),
                **options,
            ).images[0]
        finally:
            # Aussi après une erreur (OOM CUDA récupérable…) : sinon la mémoire
            # retenue s'accumule d'échec en échec.
            rendre_memoire()
    tampon = io.BytesIO()
    image.save(tampon, format="PNG")
    return {"created": int(time.time()), "data": [{"b64_json": base64.b64encode(tampon.getvalue()).decode()}]}
