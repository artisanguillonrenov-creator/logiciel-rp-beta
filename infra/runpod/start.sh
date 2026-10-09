#!/bin/bash
# Démarre les deux serveurs Elyndor Cloud sur le pod (H100 80 Go) :
# - narration : llama.cpp + L3.3 Euryale 70B v2.3 Q4_K_M, port 8000 (API OpenAI /v1/chat/completions)
# - images    : Lustify SDXL v4 + modules LoRA (diffusers), port 7860 (/v1/images/generations, /v1/embeddings)
# Idempotent : arrête les instances en cours avant de relancer.
set -u
RACINE=${ELYNDOR_ROOT:-/workspace/elyndor}
# Variables du pod (RTX 5090 : Cydonia 24B + modules RP et agent) ; sans
# elles, configuration H100 historique (Euryale 70B).
MODELE_TEXTE=${ELYNDOR_MODELE_TEXTE:-$RACINE/models/text/L3.3-70B-Euryale-v2.3-Q4_K_M.gguf}
ALIAS=${ELYNDOR_ALIAS:-euryale-70b-v2.3}
CONTEXTE=${ELYNDOR_CONTEXTE:-24576}
# Modules LoRA du narrateur (RP Elyndor, agent Cortana) : chargés mais à 0
# par défaut, choisis par requête (champ « lora » de l'API llama-server).
# ELYNDOR_LORA_DEFAUT=1 active le premier par défaut. Le module RP rendait
# le narrateur plus sage et plus court : il est désactivé.
MODULES_TEXTE=""
for m in ${ELYNDOR_LORAS:-}; do [ -f "$m" ] && MODULES_TEXTE="$MODULES_TEXTE --lora $m"; done
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
[ -n "$MODULES_TEXTE" ] && MODULES_TEXTE="$MODULES_TEXTE --lora-init-without-apply"
# Modèle de conversation avec outils (Cortana) : celui de Cydonia les ignore.
# Pour Cydonia, celui copié à côté de ce script par install-5090.sh (ou celui
# du dépôt) sert par défaut ; ELYNDOR_CHAT_TEMPLATE le remplace.
GABARIT=""
case "$MODELE_TEXTE" in
  *[Cc]ydonia*)
    for g in "$SCRIPTS/cydonia-outils.jinja" "$SCRIPTS/templates/cydonia-outils.jinja"; do
      [ -z "${ELYNDOR_CHAT_TEMPLATE:-}" ] && [ -f "$g" ] && ELYNDOR_CHAT_TEMPLATE=$g
    done
    [ -f "${ELYNDOR_CHAT_TEMPLATE:-}" ] || echo "$(date -u +%FT%TZ) modèle de conversation avec outils absent : appels d'outils indisponibles"
    ;;
esac
[ -n "${ELYNDOR_CHAT_TEMPLATE:-}" ] && [ -f "$ELYNDOR_CHAT_TEMPLATE" ] && GABARIT="--chat-template-file $ELYNDOR_CHAT_TEMPLATE"
setsid nohup "$LLAMA" -m "$MODELE_TEXTE" --alias "$ALIAS" $CACHE_PROMPTS $MODULES_TEXTE $GABARIT \
  --host 0.0.0.0 --port 8000 -ngl 99 -c "$CONTEXTE" -np 1 -fa on --metrics --jinja \
  --cache-type-k q8_0 --cache-type-v q8_0 -t 16 \
  --min-p 0.05 --repeat-penalty 1.05 --repeat-last-n 512 \
  --dry-multiplier 0.8 --dry-base 1.75 --dry-allowed-length 2 --dry-penalty-last-n 2048 \
  > "$RACINE/logs/llama.log" 2>&1 < /dev/null &

# Le serveur d'images démarre après le chargement du narrateur pour que la
# mémoire vidéo réservée par llama.cpp soit connue.
until curl -sf localhost:8000/health > /dev/null; do sleep 2; done
# Échelles par défaut : tous à 0, sauf le premier si ELYNDOR_LORA_DEFAUT=1.
if [ -n "$MODULES_TEXTE" ]; then
  curl -sf localhost:8000/lora-adapters -H 'Content-Type: application/json' \
    -d "$(python3 -c "import json,sys;n=int(sys.argv[1]);print(json.dumps([{'id':i,'scale':1.0 if i==0 and sys.argv[2]=='1' else 0.0} for i in range(n)]))" "$(echo $MODULES_TEXTE | grep -o -- '--lora ' | wc -l)" "${ELYNDOR_LORA_DEFAUT:-0}")" > /dev/null
fi
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
