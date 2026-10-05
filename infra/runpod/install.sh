#!/bin/bash
# Installation du pod Elyndor Cloud (image runpod/pytorch, GPU A40 48 Go).
# Tout est posé sur le disque conteneur (/root), effacé à chaque arrêt du
# pod : relancer ce script puis start.sh après un redémarrage (~10 min).
# Idempotent : chaque étape est sautée si son résultat existe déjà.
set -euo pipefail
export HF_HUB_ENABLE_HF_TRANSFER=1

# 1. Dépendances Python (tokenizers en roue précompilée : pas de Rust sur l'image).
pip install -q -U --prefer-binary --only-binary=tokenizers \
  "huggingface_hub[hf_transfer]" hf_transfer diffusers transformers accelerate \
  safetensors compel fastapi "uvicorn[standard]" pillow

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

echo "INSTALL_OK"
