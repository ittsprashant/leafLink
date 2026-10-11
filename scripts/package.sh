#!/bin/sh
# Builds the zip to upload to the Chrome Web Store, containing only the files the extension needs.
set -e
cd "$(dirname "$0")/.."

VERSION=$(node -p "require('./manifest.json').version")
OUT="dist/linkleaf-$VERSION.zip"

mkdir -p dist
rm -f "$OUT"
zip -r -X "$OUT" \
    manifest.json \
    background.js config.js codec.js leaf.js \
    popup.html popup.css popup.js \
    icons/icon16.png icons/icon48.png icons/icon128.png

echo "Created $OUT"
