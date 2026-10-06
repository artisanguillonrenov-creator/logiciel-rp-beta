#!/bin/bash
# Lancé à chaque démarrage du pod par sa commande de démarrage :
#   bash -c '/start.sh & until [ -f /workspace/elyndor/boot.sh ]; do sleep 30; done; bash /workspace/elyndor/boot.sh; sleep infinity'
# Démarre les serveurs puis la surveillance d'inactivité (arrêt après 90 min).
RACINE=${ELYNDOR_ROOT:-/workspace/elyndor}
export ELYNDOR_ROOT=$RACINE
# Fenêtre d'inactivité avant arrêt automatique (min). 90 pour laisser le temps de jouer.
export ELYNDOR_INACTIVITE_MIN=${ELYNDOR_INACTIVITE_MIN:-90}
echo "$(date -u +%FT%TZ) démarrage du pod ${RUNPOD_POD_ID:-?}" >> "$RACINE/logs/boot.log"
bash "$RACINE/app/start.sh" >> "$RACINE/logs/boot.log" 2>&1
setsid nohup bash "$RACINE/app/watchdog.sh" >> "$RACINE/logs/watchdog.log" 2>&1 < /dev/null &
