#!/bin/bash
# Migration du volume Elyndor Cloud vers Euryale 70B (narration) et
# Chroma1-HD (images). À lancer une fois, depuis un terminal du pod :
#   bash <(curl -fsSL https://raw.githubusercontent.com/artisanguillonrenov-creator/logiciel-rp-beta/claude/new-session-glwy6e/infra/runpod/migrer-euryale-chroma.sh)
# Supprime les anciens modèles et les essais de la soirée du 6 octobre
# (tabbyAPI, Painted Fantasy, Flux incomplet), installe les scripts à jour,
# puis télécharge les nouveaux modèles via install.sh (idempotent).
set -euo pipefail
R=${ELYNDOR_ROOT:-/workspace/elyndor}
BRANCHE=${ELYNDOR_BRANCHE:-claude/new-session-glwy6e}
B=https://raw.githubusercontent.com/artisanguillonrenov-creator/logiciel-rp-beta/$BRANCHE/infra/runpod

echo "== Nettoyage"
rm -rf "$R/tabbyAPI" "$R/models/painted-fantasy" "$R/models/image/flux1-dev" "$R/models/image/flux-lora" \
  "$R/models/image/candidats" "$R/models/image/lustify-v4" "$R/models/ip-adapter" \
  "$R/models/text/Cydonia-24B-v4.3-Q6_K.gguf" "$R/painted-fantasy.pid" /workspace/huggingface
df -h /workspace | tail -1

echo "== Scripts à jour"
mkdir -p "$R/src"
for f in start.sh watchdog.sh image_server.py install.sh boot.sh; do curl -fsSL "$B/$f" -o "$R/src/$f"; done

echo "== Dépendances et modèles (~70 Go, compter 15 à 30 min)"
pkill -f "llama-server" || true
pkill -f "uvicorn image_server" || true
ELYNDOR_ROOT=$R bash "$R/src/install.sh"
"$R/venv/bin/python" -c "from diffusers import ChromaPipeline; print('ChromaPipeline OK')"
df -h /workspace | tail -1
echo "MIGRATION_OK : redémarre le pod pour lancer Euryale et Chroma."
