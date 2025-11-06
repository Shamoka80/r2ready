# verify_tag_pkg.sh
set -euo pipefail

REPO="${REPO:-Shamoka80/R2v3APP}"                           # owner/repo
TAG="${TAG:-$(git tag --list 'prelaunch-*' --sort=-creatordate | head -1)}"
[ -n "$TAG" ] || { echo "No prelaunch-* tag found."; exit 1; }

TS="$(printf '%s' "$TAG" | sed -n 's/.*-\([0-9]\{14\}\)$/\1/p')"
[ -n "$TS" ] || { echo "Could not extract timestamp from TAG: $TAG"; exit 1; }

PKG="${PKG:-releases/rur2_prelaunch_${TS}.tar.gz}"
ASSET_NAME="$(basename "$PKG")"
PKG_EXISTS=$([ -f "$PKG" ] && echo yes || echo no)

api() {
  curl -sS -H "Authorization: Bearer ${GITHUB_TOKEN:-}" -H "Accept: application/vnd.github+json" \
    "https://api.github.com/repos/${REPO}$1"
}

# Release lookup (404 means tag exists but no release yet)
REL_JSON="$(api "/releases/tags/${TAG}")" || true
REL_ID="$(printf '%s' "$REL_JSON" | python - <<'PY'
import sys,json
try:
    j=json.load(sys.stdin); print(j.get("id",""))
except Exception:
    print("")
PY
)"

ASSET_EXISTS="no"
if [ -n "$REL_ID" ] && [ "$REL_ID" != "None" ]; then
  ASSETS="$(api "/releases/${REL_ID}/assets")"
  ASSET_EXISTS="$(printf '%s' "$ASSETS" | ASSET_NAME="$ASSET_NAME" python - <<'PY'
import sys, json, os
s=sys.stdin.read().strip()
try:
    arr=json.loads(s)
    name=os.environ["ASSET_NAME"]
    print("yes" if any(a.get("name")==name for a in arr) else "no")
except Exception:
    print("no")
PY
)"
fi

# Recommendation
ACTION="ok"
if [ "$PKG_EXISTS" = "no" ]; then
  ACTION="build_pkg"
elif [ -z "$REL_ID" ] || [ "$REL_ID" = "None" ]; then
  ACTION="create_release"
elif [ "$ASSET_EXISTS" = "no" ]; then
  ACTION="upload_asset"
fi

printf '{"repo":"%s","tag":"%s","ts":"%s","pkg":"%s","pkg_exists":"%s","release_id":"%s","asset_exists":"%s","action":"%s"}\n' \
  "$REPO" "$TAG" "$TS" "$PKG" "$PKG_EXISTS" "${REL_ID:-}" "$ASSET_EXISTS" "$ACTION"
