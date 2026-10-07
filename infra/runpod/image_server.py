"""Serveur d'images Elyndor Cloud (Chroma1-HD, base Flux, sans filtre).

Contrat attendu par l'app (src/engine/elyndorCloudImages.ts) :
POST /v1/images/generations
  {model, prompt, negative_prompt?, size: "1344x768", aspect_ratio, n, response_format: "b64_json",
   reference_images?: [data URLs], prompt_sdxl?: str}
→ {created, data: [{b64_json}]}

`prompt_sdxl` (anglais, court, rédigé par le modèle narratif) est
prioritaire : l'encodeur T5 de Chroma comprend bien mieux l'anglais que le
français. Sinon le prompt complet est utilisé (512 jetons T5 au plus).

`reference_images` est accepté mais ignoré : IP-Adapter n'existe pas pour
Chroma. Les traits de race passent par le texte du prompt.

POST /v1/embeddings (contrat OpenAI) : bge-m3 sur le CPU du pod, vecteurs
normalisés de 1024 dimensions pour l'index HNSW ObjectBox de l'app. Le CPU
laisse la mémoire vidéo au narrateur et à Chroma.
"""
import base64, ctypes, gc, hashlib, io, os, pathlib, sqlite3, threading, time

import numpy as np

import torch
from diffusers import ChromaPipeline
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

# Tout est sur le volume réseau (/workspace), conservé quand le pod s'arrête.
RACINE = os.environ.get("ELYNDOR_ROOT", "/workspace/elyndor")
# Horodatage de la dernière requête : lu par watchdog.sh pour arrêter le pod inactif.
ACTIVITE = pathlib.Path(os.environ.get("ELYNDOR_ACTIVITE", "/tmp/elyndor-activite"))
MODELE_DIR = os.environ.get("ELYNDOR_IMAGE_DIR", os.path.join(RACINE, "models/image/chroma1-hd"))
MODELE_ID = os.environ.get("ELYNDOR_IMAGE_MODELE", "chroma1-hd")
PAS = int(os.environ.get("ELYNDOR_IMAGE_STEPS", "40"))
GUIDANCE = float(os.environ.get("ELYNDOR_IMAGE_CFG", "3.0"))
EMBEDDINGS_DIR = os.environ.get("ELYNDOR_EMBEDDINGS_DIR", os.path.join(RACINE, "models/bge-m3"))
EMBEDDINGS_ID = os.environ.get("ELYNDOR_EMBEDDINGS_MODELE", "bge-m3")
NEGATIF_BASE = "low quality, ugly, unfinished, out of focus, deformed, disfigure, blurry, smudged, restricted palette, flat colors, text, logo, watermark, signature, extra limbs, extra fingers, deformed hands, bad anatomy, child, minor, underage"

pipe = ChromaPipeline.from_pretrained(MODELE_DIR, torch_dtype=torch.bfloat16)

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
# Cache persistant (volume réseau) : le lore Elyndor coûte plusieurs minutes
# de CPU ; un texte déjà vu revient instantanément, même si l'app a perdu son
# propre cache.
os.makedirs(os.path.join(RACINE, "cache"), exist_ok=True)
cache_embeddings = sqlite3.connect(os.path.join(RACINE, "cache", f"embeddings-{EMBEDDINGS_ID}.sqlite"), check_same_thread=False)
cache_embeddings.execute("CREATE TABLE IF NOT EXISTS vecteurs (cle TEXT PRIMARY KEY, vecteur BLOB NOT NULL)")
# Le narrateur 70B occupe ~47 Go du GPU. Par défaut (« aucun »), Chroma reste
# entier sur le GPU (~27 Go, H100 80 Go) : ~25 s par image au lieu de ~90 s.
# Repli sur le déchargement si la mémoire manque. « modele » ne monte
# l'encodeur T5, le transformer et le VAE qu'à leur passage (petites cartes).
DECHARGEMENT = os.environ.get("ELYNDOR_IMAGE_DECHARGEMENT", "aucun")
if DECHARGEMENT == "aucun":
    try:
        pipe.to("cuda")
    except torch.cuda.OutOfMemoryError:
        print("mémoire vidéo insuffisante : retour au déchargement CPU")
        pipe.to("cpu")
        torch.cuda.empty_cache()
        DECHARGEMENT = "modele"
if DECHARGEMENT != "aucun":
    pipe.enable_model_cpu_offload()
pipe.vae.enable_tiling()
verrou = threading.Lock()

try:
    _libc = ctypes.CDLL("libc.so.6")
except OSError:
    _libc = None


def rendre_memoire() -> None:
    """Rend au système la mémoire libérée après une génération.

    Avec le déchargement CPU, chaque image fait transiter transformer, VAE
    et encodeur entre CPU et GPU : la mémoire libérée restait réservée par
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
    return {"status": "ok", "modele": MODELE_ID, "dechargement": DECHARGEMENT, "pas": PAS, "cfg": GUIDANCE, "embeddings": encodeur is not None}


@app.post("/v1/images/generations")
def generer(req: Requete):
    largeur, hauteur = dimensions(req.size)
    positif = (req.prompt_sdxl or req.prompt).strip()
    negatif = ", ".join(x for x in [req.negative_prompt, NEGATIF_BASE] if x)
    with verrou:
        try:
            graine = req.seed if req.seed is not None else int(time.time() * 1000) % 2**31
            image = pipe(
                prompt=positif, negative_prompt=negatif,
                width=largeur, height=hauteur, num_inference_steps=PAS, guidance_scale=GUIDANCE,
                generator=torch.Generator("cpu").manual_seed(graine),
            ).images[0]
        finally:
            # Aussi après une erreur (OOM CUDA récupérable…) : sinon la mémoire
            # retenue s'accumule d'échec en échec.
            rendre_memoire()
    tampon = io.BytesIO()
    image.save(tampon, format="PNG")
    return {"created": int(time.time()), "data": [{"b64_json": base64.b64encode(tampon.getvalue()).decode()}]}
