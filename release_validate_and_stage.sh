# release_validate_and_stage.sh
set -euo pipefail

TAG="${1:-$(git tag --list 'prelaunch-*' --sort=-creatordate | head -1)}"
REMOTE=$(git remote get-url origin)
OWNER_REPO=$(echo "$REMOTE" | sed -E 's#(git@github.com:|https?://github.com/)([^/]+/[^.]+)(\.git)?#\2#')
API="https://api.github.com/repos/$OWNER_REPO"

hdrU=(-H "User-Agent: RUR2-post-release")
hdrA=(-H "Accept: application/vnd.github+json")
hdrT=()
[[ -n "${GITHUB_TOKEN:-}" ]] && hdrT=(-H "Authorization: Bearer $GITHUB_TOKEN")

# Get tarball URL for this tag
REL_JSON=$(curl -sS "${hdrU[@]}" "${hdrA[@]}" "${hdrT[@]}" "$API/releases/tags/$TAG")
PKG_URL=$(printf '%s' "$REL_JSON" | python - <<'PY'
import json,sys
j=json.load(sys.stdin)
print(next((a["browser_download_url"] for a in j.get("assets",[]) if a["name"].endswith(".tar.gz")), ""), end="")
PY
)

[[ -n "$PKG_URL" ]] || { echo "No .tar.gz asset on release $TAG"; exit 1; }

# Download to tmp and cold-verify package
TMP="$(mktemp -d)"
curl -sSL "${hdrU[@]}" "${hdrT[@]}" -o "$TMP/release.tgz" "$PKG_URL"
echo "PKG: $TMP/release.tgz"

# Uses your existing coldver.sh (supports package mode)
bash coldver.sh "$TMP/release.tgz"

echo "OK: Release $TAG validated. Ready to deploy/stage."