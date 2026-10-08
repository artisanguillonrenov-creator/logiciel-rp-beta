#!/bin/bash
# Installation d'Elyndor Cloud sur un pod RTX 5090 (32 Go) : Cydonia 24B
# Q5_K_M + modules LoRA RP (Elyndor) et agent (Cortana) pour la narration,
# Lustify SDXL + modules pour les images, bge-m3 pour les embeddings.
# Idempotent : chaque étape est sautée si son résultat existe déjà.
# Les modules LoRA du narrateur sont déposés dans $ELYNDOR_ROOT/models/text/
# (cydonia-elyndor-rp-lora.gguf, cydonia-cortana-agent-lora.gguf).
set -u
RACINE=${ELYNDOR_ROOT:-/workspace/elyndor}
SOURCES="$(cd "$(dirname "$0")" && pwd)"
export HF_HUB_ENABLE_HF_TRANSFER=1
mkdir -p "$RACINE"/{models/text,models/image,app,logs}
etat() { echo "$(date -u +%FT%TZ) $*" | tee -a "$RACINE/logs/installation.txt"; }

etat "dépendances Python"
[ -x "$RACINE/venv/bin/python" ] || python3 -m venv --system-site-packages "$RACINE/venv"
PIP="$RACINE/venv/bin/pip"
"$PIP" install -q -U --prefer-binary --only-binary=tokenizers \
  huggingface_hub hf_transfer diffusers transformers accelerate safetensors fastapi "uvicorn[standard]" pillow compel peft
"$PIP" install -q --prefer-binary sentence-transformers sentencepiece protobuf tiktoken
HF="$RACINE/venv/bin/hf"

# llama.cpp pour l'architecture Blackwell de la RTX 5090 (sm_120).
if [ ! -x "$RACINE/llama.cpp/build/bin/llama-server" ]; then
  etat "compilation de llama.cpp (sm_120)"
  command -v git > /dev/null || (apt-get update -qq && apt-get install -y -qq git cmake > /dev/null)
  [ -d "$RACINE/llama.cpp" ] || git clone --depth 1 https://github.com/ggml-org/llama.cpp "$RACINE/llama.cpp"
  cmake -S "$RACINE/llama.cpp" -B "$RACINE/llama.cpp/build" -DGGML_CUDA=ON -DCMAKE_BUILD_TYPE=Release \
    -DCMAKE_CUDA_ARCHITECTURES=120 -DLLAMA_CURL=OFF > "$RACINE/logs/cmake.log" 2>&1
  cmake --build "$RACINE/llama.cpp/build" --config Release -j "$(nproc)" --target llama-server >> "$RACINE/logs/cmake.log" 2>&1 \
    || etat "ÉCHEC compilation (logs/cmake.log)"
fi

etat "Cydonia 24B Q5_K_M"
[ -f "$RACINE/models/text/Cydonia-24B-v4.3-Q5_K_M.gguf" ] || {
  "$HF" download TheDrummer/Cydonia-24B-v4.3-GGUF Cydonia-24B-v4zg-Q5_K_M.gguf --local-dir "$RACINE/models/text" > /dev/null &&
  mv "$RACINE/models/text/Cydonia-24B-v4zg-Q5_K_M.gguf" "$RACINE/models/text/Cydonia-24B-v4.3-Q5_K_M.gguf"; }

etat "bge-m3"
[ -f "$RACINE/models/bge-m3/pytorch_model.bin" ] || \
  "$HF" download BAAI/bge-m3 config.json 1_Pooling/config.json config_sentence_transformers.json modules.json \
    pytorch_model.bin sentence_bert_config.json sentencepiece.bpe.model special_tokens_map.json \
    tokenizer.json tokenizer_config.json --local-dir "$RACINE/models/bge-m3" > /dev/null

etat "Lustify et modules d'image"
bash "$SOURCES/migrer-lustify.sh" > "$RACINE/logs/migration.log" 2>&1

cp "$SOURCES"/start.sh "$SOURCES"/watchdog.sh "$SOURCES"/image_server.py "$RACINE/app/"
cp "$SOURCES/boot.sh" "$RACINE/boot.sh"
etat "INSTALL_OK"
