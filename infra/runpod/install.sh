#!/bin/bash
# Installation du pod Elyndor Cloud (image runpod/pytorch, GPU A40 48 Go).
# Tout est posé sur le disque conteneur (/root), effacé à chaque arrêt du
# pod : relancer ce script puis start.sh après un redémarrage (~10 min).
# Idempotent : chaque étape est sautée si son résultat existe déjà.
set -euo pipefail
export HF_HUB_ENABLE_HF_TRANSFER=1

# 1. Dépendances Python (tokenizers en roue précompilée : pas de Rust sur l'image).
#    Pas d'extra « huggingface_hub[hf_transfer] » : il n'existe plus en 2.x et
#    fait boucler le résolveur de pip.
pip install -q -U --prefer-binary --only-binary=tokenizers \
  huggingface_hub hf_transfer diffusers transformers accelerate safetensors fastapi "uvicorn[standard]" pillow
pip install -q --prefer-binary compel sentence-transformers

# 2. llama.cpp compilé avec CUDA (serveur OpenAI-compatible).
if [ ! -x /root/llama.cpp/build/bin/llama-server ]; then
  [ -d /root/llama.cpp ] || git clone --depth 1 https://github.com/ggml-org/llama.cpp /root/llama.cpp
  cmake -S /root/llama.cpp -B /root/llama.cpp/build -DGGML_CUDA=ON -DCMAKE_BUILD_TYPE=Release
  cmake --build /root/llama.cpp/build --config Release -j "$(nproc)" --target llama-server
fi

# 3. Modèles : Anubis 70B v1.2 Q3_K_M (tient entièrement dans le GPU à côté
#    de SDXL) et Lustify SDXL v4 au format diffusers.
mkdir -p /root/models/text /root/models/image
[ -f /root/models/text/TheDrummer_Anubis-70B-v1.2-Q3_K_M.gguf ] || \
  hf download bartowski/TheDrummer_Anubis-70B-v1.2-GGUF TheDrummer_Anubis-70B-v1.2-Q3_K_M.gguf \
    --local-dir /root/models/text
[ -f /root/models/image/lustify-v4/model_index.json ] || \
  hf download John6666/lustify-sdxl-nsfwsfw-v4-sdxl --local-dir /root/models/image/lustify-v4

# 4. IP-Adapter SDXL (visage + continuité de scène) et son encodeur ViT-H.
[ -f /root/models/ip-adapter/sdxl_models/ip-adapter-plus-face_sdxl_vit-h.safetensors ] || \
  hf download h94/IP-Adapter \
    sdxl_models/ip-adapter-plus_sdxl_vit-h.safetensors sdxl_models/ip-adapter-plus-face_sdxl_vit-h.safetensors \
    models/image_encoder/config.json models/image_encoder/model.safetensors \
    --local-dir /root/models/ip-adapter

# 5. bge-m3 (embeddings de la recherche sémantique ObjectBox, servi sur CPU).
[ -f /root/models/bge-m3/config.json ] || \
  hf download BAAI/bge-m3 --local-dir /root/models/bge-m3 --exclude "onnx/*" "*.onnx*" "imgs/*"

echo "INSTALL_OK"
