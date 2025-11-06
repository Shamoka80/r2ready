#!/usr/bin/env bash
set -euo pipefail
PKG=${1:-$(ls -t releases/rur2_prelaunch_*.tar.gz | head -1)}
[ -f "$PKG" ] || { echo "No package found"; exit 1; }

# Ensure the templates exist locally
for f in Fixes/pdf_temp_export.pdf Fixes/email_temp_export.pdf; do
  [ -f "$f" ] || { echo "Missing locally: $f"; exit 1; }
done

TMP=$(mktemp -d)
tar -xzf "$PKG" -C "$TMP"
install -D Fixes/pdf_temp_export.pdf     "$TMP/Fixes/pdf_temp_export.pdf"
install -D Fixes/email_temp_export.pdf   "$TMP/Fixes/email_temp_export.pdf"

FIXED="${PKG%.tar.gz}_with_templates.tar.gz"
tar -C "$TMP" -czf "$FIXED" .
echo "NEW_PKG $FIXED"
bash coldver.sh "$FIXED"
