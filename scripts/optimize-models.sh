#!/bin/sh
# Optimise the 3D models for the web (mobile first):
#   models-src/core-logo.glb      → public/assets/models/core-logo.glb
#   models-src/genres/<id>.glb    → public/assets/models/genres/<id>.glb
# <id> = rap, techno, bouyon, baile-funk (see INSTALLATION_GENRES).
#
#   npm run models
#
# To replace a model: drop the new source file in models-src/ under the same
# name, then run it again. Per model:
#  - spec/gloss materials → metal/rough (three no longer reads spec/gloss);
#  - `optimize`: meshopt geometry compression (decoded by lib/core-fm/gltfLoader.ts),
#    WebP textures ≤ 512 px (the models show as ~60 ASCII glyphs wide),
#    meshes joined, unused data pruned, lossless-looking simplification.
set -eu

GT="${GLTF_TRANSFORM:-npx --yes @gltf-transform/cli@4.5.1}"
SRC=models-src
OUT=public/assets/models
TMP=$(mktemp -d)
trap 'rm -rf "$TMP"' EXIT

optimize() { # <source.glb> <output.glb>
  in="$1"
  if grep -q "KHR_materials_pbrSpecularGlossiness" "$in"; then
    $GT metalrough "$in" "$TMP/metalrough.glb"
    in="$TMP/metalrough.glb"
  fi
  $GT optimize "$in" "$2" --compress meshopt --texture-compress webp --texture-size 512
  printf '%-32s %6s → %6s\n' "$1" "$(du -h "$1" | cut -f1)" "$(du -h "$2" | cut -f1)"
}

mkdir -p "$OUT/genres"
optimize "$SRC/core-logo.glb" "$OUT/core-logo.glb"
for f in "$SRC"/genres/*.glb; do
  optimize "$f" "$OUT/genres/$(basename "$f")"
done
