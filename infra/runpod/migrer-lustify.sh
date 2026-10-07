#!/bin/bash
# Remplace Chroma1-HD par Lustify SDXL v4, l'IP-Adapter et les modules LoRA
# (peau, détails, mains, ciné, horreur, Tarantino, grain, Kodachrome).
# Idempotent : appelé par la commande de démarrage du pod avant boot.sh.
set -u
R=${ELYNDOR_ROOT:-/workspace/elyndor}
HF="$R/venv/bin/hf"
[ -x "$HF" ] || HF="$R/venv/bin/huggingface-cli"
export HF_HUB_ENABLE_HF_TRANSFER=1
"$R/venv/bin/pip" install -q compel peft > /dev/null 2>&1
[ -f "$R/models/image/lustify-v4/model_index.json" ] || \
  "$HF" download John6666/lustify-sdxl-nsfwsfw-v4-sdxl --local-dir "$R/models/image/lustify-v4"
[ -f "$R/models/ip-adapter/sdxl_models/ip-adapter-plus-face_sdxl_vit-h.safetensors" ] || \
  "$HF" download h94/IP-Adapter \
    sdxl_models/ip-adapter-plus_sdxl_vit-h.safetensors sdxl_models/ip-adapter-plus-face_sdxl_vit-h.safetensors \
    models/image_encoder/config.json models/image_encoder/model.safetensors \
    --local-dir "$R/models/ip-adapter"
M="$R/models/image/modules"
mkdir -p "$M/negatif" "$M/.hf"
module() {  # nom dépôt fichier
  [ -f "$M/$1.safetensors" ] && return
  "$HF" download "$2" "$3" --local-dir "$M/.hf/$1" > /dev/null && mv "$M/.hf/$1/$3" "$M/$1.safetensors"
}
module peau MarkBW/detailed-skin-xl "skin texture style v4.safetensors"
module peau2 Stableyogi/Super-Skin-Detailer Super_Skin_Detailer_By_Stable_Yogi_SD0_V1.safetensors
module details imagepipeline/Detail-Tweaker-XL 239209ad-d39d-471f-805e-3af555ca5681.safetensors
module mains Muapi/hands-sdxl-beta hands-sdxl-beta.safetensors
module cinema Muapi/juggernaut-cinematic-xl-lora juggernaut-cinematic-xl-lora.safetensors
module horreur Muapi/realistic-horror-style-one realistic-horror-style-one.safetensors
module tarantino KappaNeuro/director-quentin-tarantino-style "Director Quentin Tarantino style.safetensors"
module grain artificialguybr/filmgrain-redmond-filmgrain-lora-for-sdxl FilmGrainRedmond-FilmGrain-FilmGrainAF.safetensors
rm -f "$M/kodachrome.safetensors" "$M/negatif/unaestheticxl.pt"  # illisibles
module age Muapi/multiple-xl-sliders-age-weight-hands-etc multiple-xl-sliders-age-weight-hands-etc.safetensors
module kodachrome2 BlaireSilver13/Kodachrome kodachrome2.safetensors
[ -f "$M/negatif/unaestheticxl.safetensors" ] || { "$HF" download dn118/unaestheticXL unaestheticXLv31.safetensors \
  --local-dir "$M/.hf/negatif" > /dev/null && mv "$M/.hf/negatif/unaestheticXLv31.safetensors" "$M/negatif/unaestheticxl.safetensors"; }
# Chroma (~27 Go) n'est plus utilisé.
[ -f "$R/models/image/lustify-v4/model_index.json" ] && rm -rf "${R:?}/models/image/chroma1-hd"
ls -la "$M" "$R/models/image"
echo "MIGRATION_LUSTIFY_OK"
