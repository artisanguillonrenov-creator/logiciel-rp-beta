#!/bin/bash
# Installation d'Elyndor Cloud sur le volume réseau du pod (image
# runpod/pytorch, GPU A40 48 Go). Tout est posé sous $ELYNDOR_ROOT
# (/workspace/elyndor), qui survit aux arrêts du pod : à faire une seule fois.
# Idempotent : chaque étape est sautée si son résultat existe déjà.
#
# Disposition :
#   $ELYNDOR_ROOT/venv       dépendances Python (torch vient de l'image)
#   $ELYNDOR_ROOT/llama.cpp  serveur de narration compilé avec CUDA
#   $ELYNDOR_ROOT/models     Cydonia, Lustify, IP-Adapter, bge-m3
#   $ELYNDOR_ROOT/app        scripts et serveur d'images (copie de infra/runpod)
#   $ELYNDOR_ROOT/boot.sh    lancé par la commande de démarrage du pod
set -euo pipefail
RACINE=${ELYNDOR_ROOT:-/workspace/elyndor}
SOURCES="$(cd "$(dirname "$0")" && pwd)"
export HF_HUB_ENABLE_HF_TRANSFER=1
mkdir -p "$RACINE"/{models/text,models/image,app,logs}

# 1. Dépendances Python dans un venv du volume, qui réutilise le torch CUDA de
#    l'image. tokenizers en roue précompilée : pas de Rust sur l'image. Pas
#    d'extra « huggingface_hub[hf_transfer] » : il fait boucler le résolveur.
[ -x "$RACINE/venv/bin/python" ] || python3 -m venv --system-site-packages "$RACINE/venv"
PIP="$RACINE/venv/bin/pip"
"$PIP" install -q -U --prefer-binary --only-binary=tokenizers \
  huggingface_hub hf_transfer diffusers transformers accelerate safetensors fastapi "uvicorn[standard]" pillow
"$PIP" install -q --prefer-binary compel sentence-transformers
HF="$RACINE/venv/bin/hf"

# 2. llama.cpp compilé avec CUDA (serveur OpenAI-compatible).
if [ ! -x "$RACINE/llama.cpp/build/bin/llama-server" ]; then
  [ -d "$RACINE/llama.cpp" ] || git clone --depth 1 https://github.com/ggml-org/llama.cpp "$RACINE/llama.cpp"
  cmake -S "$RACINE/llama.cpp" -B "$RACINE/llama.cpp/build" -DGGML_CUDA=ON -DCMAKE_BUILD_TYPE=Release
  cmake --build "$RACINE/llama.cpp/build" --config Release -j "$(nproc)" --target llama-server
fi

# 3. Modèles : Cydonia 24B v4.3 Q6_K (base Mistral Small, choisi au comparatif
#    des narrateurs du 6 octobre) et Lustify SDXL v4 au format diffusers.
if [ ! -f "$RACINE/models/text/Cydonia-24B-v4.3-Q6_K.gguf" ]; then
  "$HF" download TheDrummer/Cydonia-24B-v4.3-GGUF Cydonia-24B-v4zg-Q6_K.gguf --local-dir "$RACINE/models/text"
  mv "$RACINE/models/text/Cydonia-24B-v4zg-Q6_K.gguf" "$RACINE/models/text/Cydonia-24B-v4.3-Q6_K.gguf"
fi
[ -f "$RACINE/models/image/lustify-v4/model_index.json" ] || \
  "$HF" download John6666/lustify-sdxl-nsfwsfw-v4-sdxl --local-dir "$RACINE/models/image/lustify-v4"

# 4. IP-Adapter SDXL (visage + continuité de scène) et son encodeur ViT-H.
[ -f "$RACINE/models/ip-adapter/sdxl_models/ip-adapter-plus-face_sdxl_vit-h.safetensors" ] || \
  "$HF" download h94/IP-Adapter \
    sdxl_models/ip-adapter-plus_sdxl_vit-h.safetensors sdxl_models/ip-adapter-plus-face_sdxl_vit-h.safetensors \
    models/image_encoder/config.json models/image_encoder/model.safetensors \
    --local-dir "$RACINE/models/ip-adapter"

# 5. bge-m3 (embeddings de la recherche sémantique ObjectBox, servi sur CPU).
#    Fichiers listés un à un : les motifs --exclude multiples de `hf` sont
#    lus comme des noms de fichiers et téléchargeaient l'inverse.
[ -f "$RACINE/models/bge-m3/pytorch_model.bin" ] || \
  "$HF" download BAAI/bge-m3 config.json 1_Pooling/config.json config_sentence_transformers.json modules.json \
    pytorch_model.bin sentence_bert_config.json sentencepiece.bpe.model special_tokens_map.json \
    tokenizer.json tokenizer_config.json --local-dir "$RACINE/models/bge-m3"

# 6. Scripts de service. boot.sh est copié en dernier : la commande de
#    démarrage du pod l'attend pour lancer les serveurs.
cp "$SOURCES"/start.sh "$SOURCES"/watchdog.sh "$SOURCES"/image_server.py "$RACINE/app/"
cp "$SOURCES/boot.sh" "$RACINE/boot.sh"
echo "INSTALL_OK"
