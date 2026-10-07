#!/bin/bash
# Pod d'entraînement (image axolotlai/axolotl). Attend les données envoyées
# sur le serveur de dépôt, entraîne la LoRA, fusionne, convertit en GGUF.
# Journaux et résultats : https://<pod>-8080.proxy.runpod.net/$JETON/<fichier>
set -u
W=/workspace/fabrique
mkdir -p "$W"
cd /workspace
# Fichiers récupérés sans git ni curl (absents de certaines images).
BRANCHE=${FABRIQUE_BRANCHE:-claude/practical-meitner-mwe2ju}
mkdir -p src/tools/fabrique
for f in serveur_depot.py axolotl-cydonia-24b.yml; do
  python3 -c "import urllib.request,sys;urllib.request.urlretrieve(sys.argv[1],sys.argv[2])" \
    "https://raw.githubusercontent.com/artisanguillonrenov-creator/logiciel-rp-beta/$BRANCHE/tools/fabrique/$f" "src/tools/fabrique/$f"
done
python3 src/tools/fabrique/serveur_depot.py 8080 "$W" "$JETON" > "$W/serveur.log" 2>&1 &
etat() { echo "$(date -u +%FT%TZ) $*" | tee -a "$W/etat.txt"; }
etat "pod prêt, en attente des données"
until [ -f "$W/go" ]; do sleep 10; done

etat "téléchargement du modèle de base et préparation"
cp src/tools/fabrique/axolotl-cydonia-24b.yml "$W/config.yml"
cd "$W"
python3 -m axolotl.cli.preprocess config.yml > preprocess.log 2>&1 || { etat "ÉCHEC préparation (preprocess.log)"; sleep infinity; }
etat "entraînement"
accelerate launch -m axolotl.cli.train config.yml > train.log 2>&1 || { etat "ÉCHEC entraînement (train.log)"; sleep infinity; }
etat "fusion de la LoRA"
python3 -m axolotl.cli.merge_lora config.yml --lora-model-dir="$W/sortie-lora" > merge.log 2>&1 || { etat "ÉCHEC fusion (merge.log)"; sleep infinity; }

etat "conversion GGUF"
(command -v git > /dev/null || (apt-get update -qq && apt-get install -y -qq git cmake build-essential > /dev/null 2>&1))
git clone --depth 1 https://github.com/ggml-org/llama.cpp /workspace/llama.cpp > /dev/null 2>&1
pip install -q -r /workspace/llama.cpp/requirements/requirements-convert_hf_to_gguf.txt > /dev/null 2>&1
python3 /workspace/llama.cpp/convert_hf_to_gguf.py "$W/sortie-lora/merged" --outtype bf16 --outfile "$W/cydonia-elyndor-bf16.gguf" > convert.log 2>&1 || { etat "ÉCHEC conversion (convert.log)"; sleep infinity; }
(cd /workspace/llama.cpp && cmake -B build -DGGML_CUDA=OFF > /dev/null && cmake --build build --target llama-quantize -j > /dev/null 2>&1)
for q in Q4_K_M Q5_K_M; do
  /workspace/llama.cpp/build/bin/llama-quantize "$W/cydonia-elyndor-bf16.gguf" "$W/cydonia-elyndor-$q.gguf" "$q" >> quantize.log 2>&1
done
rm -f "$W/cydonia-elyndor-bf16.gguf"
ls -la "$W"/*.gguf >> "$W/etat.txt"
etat "TERMINÉ"
sleep infinity
