# release_validate_and_stage_v2.sh
set -euo pipefail

TAG="${1:-}"
REMOTE=$(git remote get-url origin 2>/dev/null || echo "")
[[ -n "$REMOTE" ]] || { echo "No 'origin' remote"; exit 1; }
OWNER_REPO=$(echo "$REMOTE" | sed -E 's#(git@github.com:|https?://github.com/)([^/]+/[^.]+)(\.git)?#\2#')
API="https://api.github.com/repos/$OWNER_REPO"

hdrU=(-H "User-Agent: RUR2-post-release")
hdrA=(-H "Accept: application/vnd.github+json")
hdrT=(); [[ -n "${GITHUB_TOKEN:-}" ]] && hdrT=(-H "Authorization: Bearer $GITHUB_TOKEN")

json_or_die() { # url -> body to stdout if 200
  local url="$1" http
  http=$(curl -sS "${hdrU[@]}" "${hdrA[@]}" "${hdrT[@]}" -w "%{http_code}" -o /tmp/resp.json "$url" || true)
  [[ "$http" == "200" ]] || { echo "HTTP $http for $url"; return 1; }
  cat /tmp/resp.json
}

REL_JSON=""
[[ -n "$TAG" ]] && REL_JSON=$(json_or_die "$API/releases/tags/$TAG" || echo "")
if [[ -z "$REL_JSON" ]]; then
  REL_JSON=$(json_or_die "$API/releases/latest" || echo "")
  if [[ -z "$REL_JSON" ]]; then
    LIST=$(json_or_die "$API/releases" || echo "")
    REL_JSON=$(python - <<'PY' <<<"$LIST" || true)
import sys, json
rels=json.loads(sys.stdin.read() or "[]")
for r in rels:
    if any(a.get("name","").endswith(".tar.gz") for a in r.get("assets",[])):
        print(json.dumps(r)); sys.exit(0)
sys.exit(1)
PY
  fi
fi
[[ -n "$REL_JSON" ]] || { echo "No release found. Ensure a published release exists (and set GITHUB_TOKEN if private)."; exit 1; }

PKG_URL=$(python - <<'PY' <<<"$REL_JSON" || true)
import sys, json
r=json.loads(sys.stdin.read())
for a in r.get("assets",[]):
    if a.get("name","").endswith(".tar.gz"):
        print(a.get("browser_download_url","")); sys.exit(0)
sys.exit(1)
PY
[[ -n "$PKG_URL" ]] || { echo "No .tar.gz asset on release."; exit 1; }

TMP="$(mktemp -d)"
curl -sSL "${hdrU[@]}" "${hdrT[@]}" -o "$TMP/release.tgz" "$PKG_URL"
echo "PKG: $TMP/release.tgz"
bash coldver.sh "$TMP/release.tgz"
echo "OK: Release validated."
