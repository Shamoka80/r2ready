# release_build_bind_upload.sh
set -euo pipefail

REPO="${REPO:-Shamoka80/R2v3APP}"                  # owner/repo
TAG="${TAG:-prelaunch-20250921090651}"             # <-- set to the tag you want to publish
[ -n "${GITHUB_TOKEN:-}" ] || { echo "GITHUB_TOKEN missing"; exit 1; }

# Derive the timestamp and expected package name from TAG
TS="$(printf '%s' "$TAG" | sed -n 's/.*-\([0-9]\{14\}\)$/\1/p')"
[ -n "$TS" ] || { echo "Cannot extract timestamp from TAG '$TAG'"; exit 1; }
PKG="releases/rur2_prelaunch_${TS}.tar.gz"
ASSET_NAME="$(basename "$PKG")"

echo "→ TAG: $TAG"
echo "→ Expected package: $PKG"

# 0) Ensure template PDFs exist locally (your directive)
for f in Fixes/pdf_temp_export.pdf Fixes/email_temp_export.pdf; do
  [ -f "$f" ] || { echo "Missing required template: $f"; exit 1; }
done

# 1) Build a fresh package (Phase 7), then bind/copy to the expected name
bash phase7_release.sh >/dev/null 2>&1 || true
LATEST="$(ls -t releases/rur2_prelaunch_*.tar.gz | head -1 || true)"
[ -n "$LATEST" ] || { echo "No package produced by phase7_release.sh"; exit 1; }

if [ ! -f "$PKG" ]; then
  cp -f "$LATEST" "$PKG"
  echo "→ Bound $LATEST → $PKG"
else
  echo "→ $PKG already present"
fi

# Sanity: ensure templates are inside the tarball
tar -tzf "$PKG" Fixes/pdf_temp_export.pdf Fixes/email_temp_export.pdf >/dev/null || {
  echo "Templates not found inside $PKG; patching..."
  TMP="$(mktemp -d)"; trap 'rm -rf "$TMP"' EXIT
  tar -xzf "$LATEST" -C "$TMP"
  install -D Fixes/pdf_temp_export.pdf   "$TMP/Fixes/pdf_temp_export.pdf"
  install -D Fixes/email_temp_export.pdf "$TMP/Fixes/email_temp_export.pdf"
  tar -C "$TMP" -czf "$PKG" .
  echo "→ Patched templates into $PKG"
}

# 2) Look up (or create) the GitHub Release for TAG
api() {
  curl -sS -H "Authorization: Bearer ${GITHUB_TOKEN}" -H "Accept: application/vnd.github+json" \
    "https://api.github.com/repos/${REPO}$1"
}
post() {
  curl -sS -X POST -H "Authorization: Bearer ${GITHUB_TOKEN}" -H "Accept: application/vnd.github+json" \
    -H "Content-Type: application/json" \
    -d "$2" "https://api.github.com/repos/${REPO}$1"
}

REL_JSON="$(api "/releases/tags/${TAG}")" || true
REL_ID="$(printf '%s' "$REL_JSON" | python - <<'PY'
import sys,json
try:
    j=json.load(sys.stdin); print(j.get("id",""))
except Exception:
    print("")
PY
)"

if [ -z "$REL_ID" ] || [ "$REL_ID" = "None" ]; then
  echo "→ No release for $TAG; creating…"
  BODY=$(printf '{"tag_name":"%s","name":"%s","prerelease":true,"draft":false}' "$TAG" "$TAG")
  REL_JSON="$(post "/releases" "$BODY")"
  REL_ID="$(printf '%s' "$REL_JSON' | python - <<'PY'
import sys,json
try:
    j=json.load(sys.stdin); print(j.get("id",""))
except Exception:
    print("")
PY
)"
  [ -n "$REL_ID" ] || { echo "Failed to create release for $TAG"; echo "$REL_JSON"; exit 1; }
else
  echo "→ Release exists (id=$REL_ID)"
fi

# 3) Upload asset if missing
ASSETS="$(api "/releases/${REL_ID}/assets")"
HAS_ASSET="$(printf '%s' "$ASSETS" | ASSET_NAME="$ASSET_NAME" python - <<'PY'
import sys,json,os
s=sys.stdin.read().strip()
try:
  arr=json.loads(s)
  name=os.environ["ASSET_NAME"]
  print("yes" if any(a.get("name")==name for a in arr) else "no")
except Exception:
  print("no")
PY
)"

if [ "$HAS_ASSET" = "yes" ]; then
  echo "→ Asset already attached: $ASSET_NAME"
else
  echo "→ Uploading asset: $ASSET_NAME"
  curl -sS -X POST \
    -H "Authorization: Bearer ${GITHUB_TOKEN}" \
    -H "Content-Type: application/gzip" \
    --data-binary @"$PKG" \
    "https://uploads.github.com/repos/${REPO}/releases/${REL_ID}/assets?name=${ASSET_NAME}" >/dev/null
  echo "→ Upload complete"
fi

# 4) Verify end-state
ASSETS="$(api "/releases/${REL_ID}/assets")"
printf '%s\n' "$ASSETS" | grep -q "\"name\": \"${ASSET_NAME}\"" \
  && echo "✓ RELEASE OK: tag=$TAG, asset=$ASSET_NAME" \
  || { echo "✗ Asset not found after upload"; exit 1; }