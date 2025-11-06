#!/usr/bin/env bash
set -euo pipefail

TAG="${1:-$(git tag --list 'prelaunch-*' --sort=-creatordate | head -1)}"
REMOTE=$(git remote get-url origin)
OWNER_REPO=$(echo "$REMOTE" | sed -E 's#(git@github.com:|https?://github.com/)([^/]+/[^.]+)(\.git)?#\2#')
API="https://api.github.com/repos/$OWNER_REPO"
auth=()
[ -n "${GITHUB_TOKEN:-}" ] && auth=(-H "Authorization: Bearer $GITHUB_TOKEN")

echo "Repo: $OWNER_REPO"
echo "Tag:  $TAG"

echo "==> Latest publish.yml run"
curl -s "${auth[@]}" "$API/actions/workflows/publish.yml/runs?per_page=1" \
| python - <<'PY'
import sys, json
j=json.load(sys.stdin)
run=(j.get("workflow_runs") or [{}])[0]
print(json.dumps({
  "id": run.get("id"),
  "status": run.get("status"),
  "conclusion": run.get("conclusion"),
  "event": run.get("event"),
  "html_url": run.get("html_url"),
}, indent=2))
PY

echo "==> Release by tag"
RJSON=$(curl -s "${auth[@]}" "$API/releases/tags/$TAG" || true)
echo "$RJSON" | python - <<'PY'
import sys, json
try: j=json.load(sys.stdin)
except: print('{"found":false,"note":"no/invalid json"}'); sys.exit(0)
if "tag_name" not in j:
  print(json.dumps({"found": False, "note": "no release for tag yet"}, indent=2)); sys.exit(0)
assets=[{"name":a["name"],"size":a["size"],"url":a["browser_download_url"]} for a in j.get("assets",[])]
print(json.dumps({"found": True, "name": j.get("name"), "assets": assets, "html_url": j.get("html_url")}, indent=2))
PY

pkg_url=$(echo "$RJSON" | python - <<'PY'
import sys, json
j=json.load(sys.stdin); print(next((a["browser_download_url"] for a in j.get("assets",[]) if a["name"].endswith(".tar.gz")), ""), end="")
PY
)
sha_url=$(echo "$RJSON" | python - <<'PY'
import sys, json
j=json.load(sys.stdin); print(next((a["browser_download_url"] for a in j.get("assets",[]) if a["name"].endswith(".sha256")), ""), end="")
PY
)

if [ -n "${pkg_url:-}" ] && [ -n "${sha_url:-}" ]; then
  echo "==> Download & verify checksum"
  tmpdir=$(mktemp -d)
  curl -sL ${auth:+-H "Authorization: Bearer $GITHUB_TOKEN"} -o "$tmpdir/pkg.tgz" "$pkg_url"
  curl -sL ${auth:+-H "Authorization: Bearer $GITHUB_TOKEN"} -o "$tmpdir/pkg.sha256" "$sha_url"
  (cd "$tmpdir" && sha256sum -c pkg.sha256 && echo "SHA256_OK")
fi
