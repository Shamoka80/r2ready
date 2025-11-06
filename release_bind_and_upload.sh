# === release_bind_and_upload.sh ===
set -euo pipefail

: "${REPO:?Set REPO like 'Shamoka80/R2v3APP'}"          # owner/repo
TAG="${TAG:-$(git tag --list 'prelaunch-*' --sort=-creatordate | head -1)}"
[ -n "$TAG" ] || { echo "No TAG found."; exit 1; }

# Derive PKG from TAG timestamp (prelaunch-YYYYmmddHHMMSS)
TS="$(printf '%s' "$TAG" | sed -n 's/.*-\([0-9]\{14\}\)$/\1/p')"
[ -n "$TS" ] || { echo "Cannot extract timestamp from TAG '$TAG'."; exit 1; }
PKG="${PKG:-releases/rur2_prelaunch_${TS}.tar.gz}"
[ -f "$PKG" ] || { echo "Package not found for tag: $PKG"; exit 1; }

ASSET_NAME="$(basename "$PKG")"

api() {  # $1=method $2=path [$3=data-file]
  local m="$1" p="$2" d="${3:-}"
  curl -sS -X "$m" \
    -H "Authorization: Bearer ${GITHUB_TOKEN:?Missing GITHUB_TOKEN}" \
    -H "Accept: application/vnd.github+json" \
    ${d:+ -d @"$d"} \
    "https://api.github.com/repos/${REPO}${p}"
}

echo "REPO: $REPO"
echo "TAG : $TAG"
echo "PKG : $PKG"

# 1) Get or create release for TAG
RID=""
if J="$(api GET "/releases/tags/${TAG}")"; then
  RID="$(printf '%s' "$J" | python - <<'PY'
import sys, json; j=json.load(sys.stdin); print(j.get("id",""))
PY
)"
fi

if [ -z "${RID}" ] || [ "${RID}" = "None" ]; then
  echo "No release for ${TAG}; creating…"
  tmp=$(mktemp); printf '{"tag_name":"%s","name":"%s","draft":false,"prerelease":false}' "$TAG" "$TAG" > "$tmp"
  J="$(api POST "/releases" "$tmp")"; rm -f "$tmp"
  RID="$(printf '%s' "$J" | python - <<'PY'
import sys, json; j=json.load(sys.stdin); print(j.get("id",""))
PY
)"
  [ -n "$RID" ] || { echo "Failed to create release for $TAG"; echo "$J"; exit 1; }
fi
echo "RELEASE_ID: $RID"

# 2) If asset exists with same name, skip (or delete to replace)
HAS_ASSET="$(api GET "/releases/${RID}/assets" | python - <<PY
import sys, json; arr=json.load(sys.stdin)
print("yes" if any(a.get("name")== "$ASSET_NAME" for a in arr) else "no")
PY
)"
if [ "$HAS_ASSET" = "yes" ]; then
  echo "ASSET_EXISTS: $ASSET_NAME (leaving as-is)"
else
  echo "Uploading asset: $ASSET_NAME"
  curl -sS -X POST \
    -H "Authorization: Bearer ${GITHUB_TOKEN:?Missing GITHUB_TOKEN}" \
    -H "Content-Type: application/gzip" \
    --data-binary @"$PKG" \
    "https://uploads.github.com/repos/${REPO}/releases/${RID}/assets?name=${ASSET_NAME}" >/dev/null
  echo "ASSET_UPLOADED: $ASSET_NAME"
fi

echo "RELEASE_OK tag=$TAG asset=$ASSET_NAME"