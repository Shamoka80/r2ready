# finalize_release.sh
#!/usr/bin/env bash
set -euo pipefail

TAG="${1:-$(git tag --list 'launch-*' --sort=-creatordate | head -1)}"
[ -n "$TAG" ] || { echo "No launch tag"; exit 1; }

ORIGIN=$(git remote get-url origin 2>/dev/null || echo "https://github.com/Shamoka80/R2v3APP.git")
OWNER_REPO=$(printf "%s" "$ORIGIN" | sed -E 's|.*github.com[:/](.+?)(\.git)?$|\1|')
PKG="${2:-$(ls -t releases/rur2_prelaunch_*.tar.gz | head -1)}"
[ -f "$PKG" ] || { echo "No package found in releases/"; exit 1; }

: "${GITHUB_TOKEN:?GITHUB_TOKEN not set}"

python - <<'PY'
import os, json, sys, pathlib, urllib.request, urllib.error

repo   = os.environ['OWNER_REPO']
tag    = os.environ['TAG']
pkg    = os.environ['PKG']
token  = os.environ['GITHUB_TOKEN']

def api(url, method="GET", data=None, headers=None, raise_404=False):
    hs = {"Accept":"application/vnd.github+json","Authorization":f"Bearer {token}"}
    if headers: hs.update(headers)
    req = urllib.request.Request(url, data=data, method=method, headers=hs)
    try:
        with urllib.request.urlopen(req) as r:
            return r.getcode(), r.read()
    except urllib.error.HTTPError as e:
        if e.code==404 and not raise_404:
            return 404, b""
        raise

# 1) find or create release
code, body = api(f"https://api.github.com/repos/{repo}/releases/tags/{tag}")
if code==404:
    payload = json.dumps({"tag_name":tag,"name":tag,"prerelease":False,"draft":False}).encode()
    _, body = api(f"https://api.github.com/repos/{repo}/releases","POST",payload,{"Content-Type":"application/json"})
rel = json.loads(body)
upload_url = rel["upload_url"].split("{")[0]
assets = {a["name"]:a["id"] for a in rel.get("assets",[])}

# 2) upload asset if missing
name = pathlib.Path(pkg).name
if name not in assets:
    with open(pkg,"rb") as f:
        data = f.read()
    url = f"{upload_url}?name={name}"
    api(url,"POST",data,{"Content-Type":"application/gzip"},raise_404=True)
    print(f"ASSET_UPLOADED {name}")
else:
    print(f"ASSET_EXISTS {name}")

print(f"RELEASE_OK tag={tag} repo={repo}")
PY
