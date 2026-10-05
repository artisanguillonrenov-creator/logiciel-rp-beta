#!/bin/bash
# Démarre les deux serveurs Elyndor Cloud sur le pod (A40 48 Go) :
# - narration : llama.cpp + Anubis 70B v1.2 Q3_K_M, port 8000 (API OpenAI /v1/chat/completions)
# - images    : Lustify SDXL v4 (diffusers), port 7860 (/v1/images/generations)
# Idempotent : arrête les instances en cours avant de relancer.
set -u
MODELE_TEXTE=/root/models/text/TheDrummer_Anubis-70B-v1.2-Q3_K_M.gguf
LLAMA=/root/llama.cpp/build/bin/llama-server
SCRIPTS="$(cd "$(dirname "$0")" && pwd)"

for p in $(pgrep -f "^$LLAMA") $(pgrep -f '^python3 -m uvicorn image_server'); do kill "$p"; done
sleep 3

setsid nohup "$LLAMA" -m "$MODELE_TEXTE" --alias anubis-70b-v1.2 \
  --host 0.0.0.0 --port 8000 -ngl 99 -c 16384 -np 1 -fa on \
  --cache-type-k q8_0 --cache-type-v q8_0 -t 16 \
  > /root/llama.log 2>&1 < /dev/null &

# Le serveur d'images démarre après le chargement d'Anubis pour que la
# mémoire vidéo réservée par llama.cpp soit connue.
until curl -sf localhost:8000/health > /dev/null; do sleep 2; done
cd "$SCRIPTS" && setsid nohup python3 -m uvicorn image_server:app --host 0.0.0.0 --port 7860 \
  > /root/image.log 2>&1 < /dev/null &
until curl -sf localhost:7860/health > /dev/null; do sleep 2; done
echo "SERVEURS_OK"
