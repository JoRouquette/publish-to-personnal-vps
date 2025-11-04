#!/usr/bin/env bash
set -euo pipefail

# Dossier final du plugin (celui qu'Obsidian utilisera)
PLUGIN_DIR_NAME="publish-to-personal-vps"

# Racine du repo
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

# Dossier source du plugin (là où sont manifest.json, style.css, main.ts/js)
PLUGIN_SRC_DIR="$ROOT_DIR/obsidian-plugin"

# Dossier de sortie final
OUT_DIR="$ROOT_DIR/dist/$PLUGIN_DIR_NAME"

MAIN_JS="$PLUGIN_SRC_DIR/dist/main.js"
MANIFEST="$PLUGIN_SRC_DIR/manifest.json"
STYLES="$PLUGIN_SRC_DIR/style.css"

echo "👉 Packaging plugin from: $PLUGIN_SRC_DIR"
echo "   to: $OUT_DIR"

# Nettoyage + recréation du dossier
rm -rf "$OUT_DIR"
mkdir -p "$OUT_DIR"

# Vérif main.js
if [[ ! -f "$MAIN_JS" ]]; then
  echo "❌ main.js not found at: $MAIN_JS"
  echo "   Did you run the esbuild build (npm run build) ?"
  exit 1
fi

# Vérif manifest.json
if [[ ! -f "$MANIFEST" ]]; then
  echo "❌ manifest.json not found at: $MANIFEST"
  exit 1
fi

# Copie main.js + manifest.json
cp "$MAIN_JS" "$OUT_DIR/main.js"
cp "$MANIFEST" "$OUT_DIR/manifest.json"

# Copie style.css si présent
if [[ -f "$STYLES" ]]; then
  cp "$STYLES" "$OUT_DIR/style.css"
fi

echo "✅ Plugin packaged in: $OUT_DIR"
echo "   You can now install it in Obsidian."
