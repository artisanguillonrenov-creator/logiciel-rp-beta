"""Serveur d'images Elyndor Cloud (Lustify SDXL v4).

Contrat attendu par l'app (src/engine/elyndorCloudImages.ts) :
POST /v1/images/generations
  {model, prompt, negative_prompt?, size: "1344x768", aspect_ratio, n, response_format: "b64_json",
   reference_images?: [data URLs], prompt_sdxl?: str}
→ {created, data: [{b64_json}]}

`prompt_sdxl` (anglais, court) est prioritaire : le CLIP de SDXL est limité à
77 jetons et comprend mal le français. Sinon le prompt complet est encodé par
morceaux via compel. Les images de référence sont acceptées mais pas encore
exploitées (IP-Adapter à venir).
"""
import base64, io, os, threading, time

import torch
from compel import Compel, ReturnedEmbeddingsType
from diffusers import EulerAncestralDiscreteScheduler, StableDiffusionXLPipeline
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel

MODELE_DIR = os.environ.get("ELYNDOR_IMAGE_DIR", "/root/models/image/lustify-v4")
MODELE_ID = os.environ.get("ELYNDOR_IMAGE_MODELE", "lustify-sdxl-v4")
PAS = int(os.environ.get("ELYNDOR_IMAGE_STEPS", "30"))
GUIDANCE = float(os.environ.get("ELYNDOR_IMAGE_CFG", "5.5"))
NEGATIF_BASE = "text, logo, watermark, signature, duplicate, extra limbs, extra fingers, deformed hands, deformed face, bad anatomy, blurry, lowres, child, minor, underage"

pipe = StableDiffusionXLPipeline.from_pretrained(MODELE_DIR, torch_dtype=torch.float16, use_safetensors=True)
# DPM++ Karras plante avec la config de ce checkpoint (IndexError sur sigmas) :
# Euler a, recommandé aussi pour Lustify, est stable.
pipe.scheduler = EulerAncestralDiscreteScheduler.from_config(pipe.scheduler.config)
# Anubis occupe l'essentiel du GPU : chaque sous-modèle (encodeurs, UNet, VAE)
# n'est monté en mémoire vidéo que pendant son passage, puis rendu au CPU.
pipe.enable_model_cpu_offload()
pipe.enable_vae_tiling()
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
app = FastAPI()


class Requete(BaseModel):
    model: str | None = None
    prompt: str
    prompt_sdxl: str | None = None
    negative_prompt: str | None = None
    size: str = "1344x768"
    aspect_ratio: str | None = None
    n: int = 1
    response_format: str = "b64_json"
    reference_images: list[str] | None = None
    seed: int | None = None


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
    return {"object": "list", "data": [{"id": MODELE_ID, "object": "model"}]}


@app.get("/health")
def sante():
    return {"status": "ok"}


@app.post("/v1/images/generations")
def generer(req: Requete):
    largeur, hauteur = dimensions(req.size)
    positif = (req.prompt_sdxl or req.prompt).strip()
    negatif = ", ".join(x for x in [req.negative_prompt, NEGATIF_BASE] if x)
    with verrou:
        cond, pooled = compel(positif)
        ncond, npooled = compel(negatif)
        cond, ncond = compel.pad_conditioning_tensors_to_same_length([cond, ncond])
        graine = req.seed if req.seed is not None else int(time.time() * 1000) % 2**31
        image = pipe(
            prompt_embeds=cond, pooled_prompt_embeds=pooled,
            negative_prompt_embeds=ncond, negative_pooled_prompt_embeds=npooled,
            width=largeur, height=hauteur, num_inference_steps=PAS, guidance_scale=GUIDANCE,
            generator=torch.Generator("cuda").manual_seed(graine),
        ).images[0]
    tampon = io.BytesIO()
    image.save(tampon, format="PNG")
    return {"created": int(time.time()), "data": [{"b64_json": base64.b64encode(tampon.getvalue()).decode()}]}
