#!/usr/bin/env bash
# Sync selected brand assets into assets/images for easier runtime referencing.
# Run: bash scripts/sync_brand_assets.sh

set -euo pipefail

BASE_DIR="$(cd "$(dirname "$0")/.." && pwd)"
BRAND_DIR="$BASE_DIR/assets/Brand"
IMAGES_DIR="$BASE_DIR/assets/images"

mkdir -p "$IMAGES_DIR"

FILES=(
  "WoodLab_official_-_for_blackwhite_print.png"
  "WoodLab_logo_flat.png"
  "WoodLab_mark_-_official.png"
)

for f in "${FILES[@]}"; do
  if [ -f "$BRAND_DIR/$f" ]; then
    cp -v "$BRAND_DIR/$f" "$IMAGES_DIR/$f"
  else
    echo "Warning: $f not found in $BRAND_DIR"
  fi
done

echo "Sync complete."
