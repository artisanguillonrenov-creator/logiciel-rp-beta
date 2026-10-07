#!/bin/bash
# Pod d'entraînement du module image « style Elyndor » (LoRA SDXL sur Lustify).
# Images : portraits et scènes du dépôt (légendes tirées des noms de fichiers).
# Résultat : https://<pod>-8080.proxy.runpod.net/$JETON/elyndor-style.safetensors
set -u
W=${STYLE_DIR:-/workspace/style}
BASE=${LUSTIFY_DIR:-/workspace/lustify}
LOT=${LOT:-2}
ACCU=${ACCU:-2}
mkdir -p "$W/images"
cd "$W"
SHA=${FABRIQUE_SHA:?}
RAW=https://raw.githubusercontent.com/artisanguillonrenov-creator/logiciel-rp-beta/$SHA
python3 -c "import urllib.request,sys;urllib.request.urlretrieve(sys.argv[1],sys.argv[2])" "$RAW/tools/fabrique/serveur_depot.py" serveur_depot.py
python3 serveur_depot.py 8080 "$W" "$JETON" > "$W/serveur.log" 2>&1 &
etat() { echo "$(date -u +%FT%TZ) $*" | tee -a "$W/etat.txt"; }
etat "installation"
pip install -q "diffusers==0.35.1" "transformers==4.53.3" "accelerate==1.8.1" "peft==0.17.1" "datasets<4" bitsandbytes huggingface_hub hf_transfer > "$W/install.log" 2>&1
python3 -c "import urllib.request;urllib.request.urlretrieve('https://raw.githubusercontent.com/huggingface/diffusers/v0.35.1/examples/text_to_image/train_text_to_image_lora_sdxl.py','train.py')"
etat "images et légendes"
python3 - "$RAW" "$W/images" <<'PY'
import json, sys, urllib.request
raw, out = sys.argv[1], sys.argv[2]
races = {"amazones-nordiques": "nordic amazon", "amazones-sombres": "dark amazon", "elfes-noirs": "dark elf with ebony skin and white hair",
  "geantes": "giantess", "hauts-elfes": "high elf", "hommes-betes": "beastfolk", "humains": "human", "naga-marines": "sea naga",
  "nains": "dwarf", "orcs": "orc", "orques-nobles": "noble orc", "sirenes": "siren", "sultanats": "desert sultanate noble",
  "tribus-primales": "primal tribal", "valkyries": "valkyrie"}
genres = {"femme": "adult woman", "homme": "adult man", "autre": "androgynous adult"}
fichiers = [(f"assets/portraits/{r}-{g}.png", f"elyndor style, dark fantasy portrait of a {d} {genres[g]}, ornate jewelry, cinematic lighting")
            for r, d in races.items() for g in genres]
fichiers += [
 ("assets/portraits/elyndor/character-elfe-noire-serment.png", "elyndor style, dark fantasy portrait of a dark elf woman bound by an oath"),
 ("assets/portraits/elyndor/character-humain-garde-dechu.png", "elyndor style, dark fantasy portrait of a fallen human guard"),
 ("assets/portraits/elyndor/character-naga-marine-veilleuse.png", "elyndor style, dark fantasy portrait of a sea naga watcher"),
 ("assets/portraits/elyndor/character-orque-noble-dette.png", "elyndor style, dark fantasy portrait of a noble orc in debt"),
 ("assets/scenes/accueil.png", "elyndor style, dark fantasy landscape, epic kingdom at night"),
 ("assets/scenes/cour-des-serments.png", "elyndor style, lone warrior before three giant gothic gates with golden sigils, moonlit castle, night"),
 ("assets/scenes/creation-histoire.png", "elyndor style, dark fantasy scene, ancient book of stories"),
 ("assets/scenes/creation-personnage.png", "elyndor style, dark fantasy scene, hero choosing a destiny"),
 ("assets/scenes/creation-point-depart.png", "elyndor style, dark fantasy scene, road leading to distant lands"),
 ("assets/scenes/creation-preferences.png", "elyndor style, dark fantasy scene, mystical chamber"),
 ("art-direction-concepts/elyndor-first-choice.png", "elyndor style, dark fantasy scene, first choice of the hero"),
 ("art-direction-concepts/elyndor-store-hero.png", "elyndor style, dark fantasy heroes, epic key art"),
]
with open(f"{out}/metadata.jsonl", "w") as m:
    for i, (chemin, legende) in enumerate(fichiers):
        nom = f"{i:03d}.png"
        urllib.request.urlretrieve(f"{raw}/{chemin}", f"{out}/{nom}")
        m.write(json.dumps({"file_name": nom, "text": legende}) + "\n")
print(len(fichiers), "images")
PY
etat "téléchargement de Lustify"
[ -f "$BASE/model_index.json" ] || HF_HUB_ENABLE_HF_TRANSFER=1 python3 -c "import sys;from huggingface_hub import snapshot_download;snapshot_download('John6666/lustify-sdxl-nsfwsfw-v4-sdxl',local_dir=sys.argv[1])" "$BASE" >> "$W/install.log" 2>&1
etat "entraînement"
accelerate launch --mixed_precision=bf16 train.py \
  --pretrained_model_name_or_path="$BASE" --pretrained_vae_model_name_or_path=madebyollin/sdxl-vae-fp16-fix \
  --train_data_dir="$W/images" --caption_column=text --resolution=1024 --random_flip \
  --train_batch_size=$LOT --gradient_accumulation_steps=$ACCU --gradient_checkpointing --max_train_steps=1200 \
  --learning_rate=1e-4 --lr_scheduler=cosine --lr_warmup_steps=60 --rank=32 --mixed_precision=bf16 \
  --checkpointing_steps=400 --seed=42 --output_dir="$W/sortie" > "$W/train.log" 2>&1 || { etat "ÉCHEC entraînement (train.log)"; sleep infinity; }
cp "$W/sortie/pytorch_lora_weights.safetensors" "$W/elyndor-style.safetensors"
[ -n "${MODULES_DIR:-}" ] && cp "$W/elyndor-style.safetensors" "$MODULES_DIR/elyndor.safetensors"
etat "TERMINÉ"
sleep infinity
