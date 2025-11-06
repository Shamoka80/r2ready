#!/usr/bin/env bash
set -euo pipefail

FIX=${FIX:-./Fixes}
PDF1="$FIX/pdf_temp_export.pdf"
PDF2="$FIX/email_temp_export.pdf"

# 0) Guard: templates must exist locally
for f in "$PDF1" "$PDF2"; do
  [[ -f "$f" ]] || { echo "MISSING locally: $f"; exit 1; }
done

# 1) Find latest package (create if none)
if ! ls releases/rur2_prelaunch_*.tar.gz >/dev/null 2>&1; then
  [[ -x ./phase7_release.sh ]] || { echo "No package and no phase7_release.sh"; exit 1; }
  bash ./phase7_release.sh
fi
PKG="$(ls -t releases/rur2_prelaunch_*.tar.gz | head -1)"
echo "LATEST PKG: $PKG"

# 2) Inject templates into the package
TMP="$(mktemp -d)"
tar -xzf "$PKG" -C "$TMP"
install -D "$PDF1" "$TMP/Fixes/pdf_temp_export.pdf"
install -D "$PDF2" "$TMP/Fixes/email_temp_export.pdf"
PATCHED="${PKG%.tar.gz}_with_templates.tar.gz"
tar -C "$TMP" -czf "$PATCHED" .
echo "PATCHED PKG: $PATCHED"

# 3) Local cold verify against the patched package
bash ./coldver.sh "$PATCHED"
if ! bash ./coldver.sh "$PATCHED" | grep -q 'COLD_VERIFY_OK True'; then
  echo "Cold verify failed on patched package"; exit 1
fi

# 4) Ensure templates are tracked in git and trigger CI
printf '\n!Fixes/pdf_temp_export.pdf\n!Fixes/email_temp_export.pdf\n' >> .gitignore
git add -f "$PDF1" "$PDF2" .gitignore || true
git commit -m "Ensure template PDFs tracked; patched release includes them" || true
git push || true
echo "DONE: templates injected, verified, and CI triggered."
