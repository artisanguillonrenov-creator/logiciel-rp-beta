#!/bin/bash
# Démarrage du pod CPU de fabrication (image node:20). La fabrique tourne
# ici plutôt que dans une session de travail, qui peut redémarrer : les
# parties sont sauvegardées sur /data (volume du pod) et reprises au
# redémarrage. Les résultats sont servis en lecture sur le port 8080, sous
# un chemin secret ($FABRIQUE_JETON).
set -u
mkdir -p /data/fab /data/web
cd /data
rm -rf src
git clone --depth 1 -b "${FABRIQUE_BRANCHE:-claude/practical-meitner-mwe2ju}" https://github.com/artisanguillonrenov-creator/logiciel-rp-beta.git src
ln -sfn /data/fab "/data/web/${FABRIQUE_JETON:-prive}"
# Page vide à la racine : pas de liste du dossier, le chemin reste secret.
echo "" > /data/web/index.html
(cd /data/web && python3 -m http.server 8080 > /data/http.log 2>&1 &)
FABRIQUE_MONDES=/data/src/tools/fabrique/mondes FABRIQUE_TMP=/tmp \
  node /data/src/tools/fabrique/dist/fabrique.cjs /data/fab "${FABRIQUE_PARTIES:-40}" "${FABRIQUE_MINUTES:-6000}" >> /data/fab/stdout.txt 2>&1
echo "fabrique terminée $(date -u)" >> /data/fab/stdout.txt
sleep infinity
