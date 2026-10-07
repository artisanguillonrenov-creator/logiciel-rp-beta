#!/bin/bash
# Installation d'Elyndor Cloud sur le volume réseau du pod (image
# runpod/pytorch, GPU H100 80 Go). Tout est posé sous $ELYNDOR_ROOT
# (/workspace/elyndor), qui survit aux arrêts du pod : à faire une seule fois.
# Idempotent : chaque étape est sautée si son résultat existe déjà.
#
# Disposition :
#   $ELYNDOR_ROOT/venv       dépendances Python (torch vient de l'image)
#   $ELYNDOR_ROOT/llama.cpp  serveur de narration compilé avec CUDA
#   $ELYNDOR_ROOT/models     Euryale 70B, Chroma1-HD, bge-m3
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
"$PIP" install -q --prefer-binary sentence-transformers sentencepiece protobuf tiktoken
HF="$RACINE/venv/bin/hf"

# 2. llama.cpp compilé avec CUDA (serveur OpenAI-compatible).
if [ ! -x "$RACINE/llama.cpp/build/bin/llama-server" ]; then
  [ -d "$RACINE/llama.cpp" ] || git clone --depth 1 https://github.com/ggml-org/llama.cpp "$RACINE/llama.cpp"
  cmake -S "$RACINE/llama.cpp" -B "$RACINE/llama.cpp/build" -DGGML_CUDA=ON -DCMAKE_BUILD_TYPE=Release
  cmake --build "$RACINE/llama.cpp/build" --config Release -j "$(nproc)" --target llama-server
fi

# 3. Modèles : L3.3 Euryale 70B v2.3 Q4_K_M (narration NSFW, ~42,5 Go) et
#    Chroma1-HD au format diffusers (images sans filtre, ~27,5 Go). Fichiers
#    listés un à un (voir bge-m3 plus bas) : le fichier unique
#    Chroma1-HD.safetensors (format ComfyUI, 17,8 Go) n'est pas téléchargé.
[ -f "$RACINE/models/text/L3.3-70B-Euryale-v2.3-Q4_K_M.gguf" ] || \
  "$HF" download bartowski/L3.3-70B-Euryale-v2.3-GGUF L3.3-70B-Euryale-v2.3-Q4_K_M.gguf --local-dir "$RACINE/models/text"
[ -f "$RACINE/models/image/chroma1-hd/vae/diffusion_pytorch_model.safetensors" ] || \
  "$HF" download lodestones/Chroma1-HD model_index.json scheduler/scheduler_config.json \
    text_encoder/config.json text_encoder/model-00001-of-00002.safetensors text_encoder/model-00002-of-00002.safetensors \
    text_encoder/model.safetensors.index.json tokenizer/added_tokens.json tokenizer/special_tokens_map.json \
    tokenizer/spiece.model tokenizer/tokenizer_config.json transformer/config.json \
    transformer/diffusion_pytorch_model-00001-of-00002.safetensors transformer/diffusion_pytorch_model-00002-of-00002.safetensors \
    transformer/diffusion_pytorch_model.safetensors.index.json vae/config.json vae/diffusion_pytorch_model.safetensors \
    --local-dir "$RACINE/models/image/chroma1-hd"

# 4. bge-m3 (embeddings de la recherche sémantique ObjectBox, servi sur CPU).
#    Fichiers listés un à un : les motifs --exclude multiples de `hf` sont
#    lus comme des noms de fichiers et téléchargeaient l'inverse.
[ -f "$RACINE/models/bge-m3/pytorch_model.bin" ] || \
  "$HF" download BAAI/bge-m3 config.json 1_Pooling/config.json config_sentence_transformers.json modules.json \
    pytorch_model.bin sentence_bert_config.json sentencepiece.bpe.model special_tokens_map.json \
    tokenizer.json tokenizer_config.json --local-dir "$RACINE/models/bge-m3"

# 5. Scripts de service. boot.sh est copié en dernier : la commande de
#    démarrage du pod l'attend pour lancer les serveurs.
cp "$SOURCES"/start.sh "$SOURCES"/watchdog.sh "$SOURCES"/image_server.py "$RACINE/app/"
cp "$SOURCES/boot.sh" "$RACINE/boot.sh"
echo "INSTALL_OK"
