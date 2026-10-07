#!/bin/bash
# Pod d'entraînement (image runpod/pytorch, Axolotl installé au démarrage). Attend les données envoyées
# sur le serveur de dépôt, entraîne la LoRA, fusionne, convertit en GGUF.
# Journaux et résultats : https://<pod>-8080.proxy.runpod.net/$JETON/<fichier>
set -u
W=/workspace/fabrique
mkdir -p "$W"
cd /workspace
# Fichiers récupérés sans git ni curl (absents de certaines images).
BRANCHE=${FABRIQUE_BRANCHE:-claude/practical-meitner-mwe2ju}
mkdir -p src/tools/fabrique
CONFIG=${CONFIG:-axolotl-cydonia-24b.yml}
NOM=${NOM:-cydonia-elyndor}
for f in serveur_depot.py "$CONFIG"; do
  python3 -c "import urllib.request,sys;urllib.request.urlretrieve(sys.argv[1],sys.argv[2])" \
    "https://raw.githubusercontent.com/artisanguillonrenov-creator/logiciel-rp-beta/$BRANCHE/tools/fabrique/$f" "src/tools/fabrique/$f"
done
python3 src/tools/fabrique/serveur_depot.py 8080 "$W" "$JETON" > "$W/serveur.log" 2>&1 &
etat() { echo "$(date -u +%FT%TZ) $*" | tee -a "$W/etat.txt"; }
etat "installation d'Axolotl"
pip install -q --upgrade pip > "$W/install.log" 2>&1
pip install -q axolotl >> "$W/install.log" 2>&1 || { etat "ÉCHEC installation (install.log)"; sleep infinity; }
# Axolotl met PyTorch à jour : les torchvision/torchaudio de l'image, liés à
# l'ancienne version, cassent l'import de transformers. Inutiles ici.
pip uninstall -y -q torchvision torchaudio >> "$W/install.log" 2>&1
etat "pod prêt, en attente des données"
until [ -f "$W/go" ]; do sleep 10; done

etat "téléchargement du modèle de base et préparation"
cp "src/tools/fabrique/$CONFIG" "$W/config.yml"
cd "$W"
python3 -m axolotl.cli.preprocess config.yml > preprocess.log 2>&1 || { etat "ÉCHEC préparation (preprocess.log)"; sleep infinity; }
etat "entraînement"
accelerate launch -m axolotl.cli.train config.yml > train.log 2>&1 || { etat "ÉCHEC entraînement (train.log)"; sleep infinity; }
# Le module reste séparé du socle (un module RP, un module agent) : seule
# la LoRA est convertie en GGUF, à charger avec llama-server --lora.
etat "conversion du module en GGUF"
(command -v git > /dev/null || (apt-get update -qq && apt-get install -y -qq git > /dev/null 2>&1))
git clone --depth 1 https://github.com/ggml-org/llama.cpp /workspace/llama.cpp > /dev/null 2>&1
pip install -q -r /workspace/llama.cpp/requirements/requirements-convert_lora_to_gguf.txt > /dev/null 2>&1 \
  || pip install -q gguf sentencepiece > /dev/null 2>&1
python3 /workspace/llama.cpp/convert_lora_to_gguf.py "$W/sortie-lora" --base-model-id TheDrummer/Cydonia-24B-v4.3 \
  --outtype f16 --outfile "$W/$NOM-lora.gguf" > convert.log 2>&1 || { etat "ÉCHEC conversion (convert.log)"; sleep infinity; }
ls -la "$W"/*.gguf >> "$W/etat.txt"
etat "TERMINÉ"
sleep infinity
