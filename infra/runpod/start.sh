#!/bin/bash
# Démarre les deux serveurs Elyndor Cloud sur le pod (H100 80 Go) :
# - narration : llama.cpp + L3.3 Euryale 70B v2.3 Q4_K_M, port 8000 (API OpenAI /v1/chat/completions)
# - images    : Chroma1-HD (diffusers), port 7860 (/v1/images/generations, /v1/embeddings)
# Idempotent : arrête les instances en cours avant de relancer.
set -u
RACINE=${ELYNDOR_ROOT:-/workspace/elyndor}
MODELE_TEXTE=$RACINE/models/text/L3.3-70B-Euryale-v2.3-Q4_K_M.gguf
LLAMA=$RACINE/llama.cpp/build/bin/llama-server
PYTHON=$RACINE/venv/bin/python
SCRIPTS="$(cd "$(dirname "$0")" && pwd)"
mkdir -p "$RACINE/logs"

for p in $(pgrep -f "^$LLAMA") $(pgrep -f "elyndor-boucle-images") $(pgrep -f "^$PYTHON -m uvicorn image_server"); do kill "$p"; done
sleep 3

# --metrics : compteurs de jetons lus par watchdog.sh pour détecter l'activité.
# Échantillonnage par défaut (l'app n'envoie que température et longueur) :
# sans pénalité, le narrateur pouvait boucler sur les mêmes phrases jusqu'au
# plafond de jetons. DRY casse les séquences répétées, la pénalité de
# répétition légère et min-p écartent les mots improbables.
# Cache des prompts en RAM : entre deux tours, les petits appels (lore
# émergent, prompts d'image) prennent l'unique slot ; sans ce cache, le
# narrateur relisait ses ~18 000 jetons à chaque tour. Option ajoutée
# seulement si ce llama-server la connaît, pour ne jamais bloquer le démarrage.
CACHE_PROMPTS=""
"$LLAMA" --help 2>&1 | grep -q -- "--cache-ram" && CACHE_PROMPTS="--cache-ram 16384"
setsid nohup "$LLAMA" -m "$MODELE_TEXTE" --alias euryale-70b-v2.3 $CACHE_PROMPTS \
  --host 0.0.0.0 --port 8000 -ngl 99 -c 24576 -np 1 -fa on --metrics --jinja \
  --cache-type-k q8_0 --cache-type-v q8_0 -t 16 \
  --min-p 0.05 --repeat-penalty 1.05 --repeat-last-n 512 \
  --dry-multiplier 0.8 --dry-base 1.75 --dry-allowed-length 2 --dry-penalty-last-n 2048 \
  > "$RACINE/logs/llama.log" 2>&1 < /dev/null &

# Le serveur d'images démarre après le chargement du narrateur pour que la
# mémoire vidéo réservée par llama.cpp soit connue.
until curl -sf localhost:8000/health > /dev/null; do sleep 2; done
# Boucle de relance : si le serveur d'images s'arrête (mémoire, plantage),
# il redémarre seul au lieu de laisser l'app en erreur 502 jusqu'au
# prochain démarrage du pod. MALLOC_ARENA_MAX limite la fragmentation de
# la mémoire due aux allers-retours CPU/GPU du déchargement.
cd "$SCRIPTS" && setsid nohup bash -c 'while true; do  # elyndor-boucle-images
    MALLOC_ARENA_MAX=2 ELYNDOR_ROOT="$0" "$1" -m uvicorn image_server:app --host 0.0.0.0 --port 7860
    echo "$(date -u +%FT%TZ) serveur d images arrete, relance dans 5 s"; sleep 5
  done' "$RACINE" "$PYTHON" >> "$RACINE/logs/image.log" 2>&1 < /dev/null &
until curl -sf localhost:7860/health > /dev/null; do sleep 2; done
echo "SERVEURS_OK"
