#!/bin/bash
# Arrête le pod après ELYNDOR_INACTIVITE_MIN minutes (30 par défaut) sans
# requête de l'app. Un pod arrêté ne coûte que le stockage du volume : les
# modèles et l'installation (sur /workspace) sont conservés.
#
# Activité = jetons traités par llama.cpp (/metrics), requête en cours, ou
# requête au serveur d'images (horodatage écrit par image_server.py).
# Le fichier $ELYNDOR_ROOT/garder-allume suspend l'arrêt (maintenance).
RACINE=${ELYNDOR_ROOT:-/workspace/elyndor}
LIMITE=$(( ${ELYNDOR_INACTIVITE_MIN:-30} * 60 ))
ACTIVITE=${ELYNDOR_ACTIVITE:-/tmp/elyndor-activite}
derniere=$(date +%s)
signature=""

journal() { echo "$(date -u +%FT%TZ) $*"; }
journal "surveillance active, arrêt après $((LIMITE / 60)) min d'inactivité"

while true; do
  sleep 60
  maintenant=$(date +%s)
  metriques=$(curl -sf --max-time 10 localhost:8000/metrics \
    | grep -E '^llamacpp:(prompt_tokens_total|tokens_predicted_total|requests_processing) ')
  if [ "$metriques" != "$signature" ] || echo "$metriques" | grep -qE 'requests_processing [1-9]'; then
    signature=$metriques
    derniere=$maintenant
  fi
  if [ -f "$ACTIVITE" ] && [ "$(stat -c %Y "$ACTIVITE")" -gt "$derniere" ]; then
    derniere=$(stat -c %Y "$ACTIVITE")
  fi
  [ -f "$RACINE/garder-allume" ] && derniere=$maintenant

  if (( maintenant - derniere >= LIMITE )); then
    journal "inactif depuis $(( (maintenant - derniere) / 60 )) min : arrêt du pod ${RUNPOD_POD_ID}"
    curl -sf -X POST "https://rest.runpod.io/v1/pods/${RUNPOD_POD_ID}/stop" \
      -H "Authorization: Bearer ${RUNPOD_API_KEY}" > /dev/null \
      || runpodctl stop pod "$RUNPOD_POD_ID" \
      || journal "échec de l'arrêt, nouvel essai dans 5 min"
    derniere=$(( maintenant - LIMITE + 300 ))
  fi
done
