# finalize_release_v2.sh
#!/usr/bin/env bash
set -euo pipefail

: "${OWNER_REPO:?OWNER_REPO not set (e.g., Shamoka80/R2v3APP)}"
: "${TAG:?TAG not set (e.g., prelaunch-20250921090651)}"
: "${PKG:?PKG not set (path to .tar.gz)}"
: "${GITHUB_TOKEN:?GITHUB_TOKEN not set(e.g., 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)}"

python - <<'PY'
import os, json, sys, pathlib, urllib.request, urllib.error

repo   = os.environ['OWNER_REPO']
tag    = os.environ['TAG']
pkg    = os.environ['PKG']
token  = os.environ['GITHUB_TOKEN']

def req(url, method="GET", data=None, headers=None):
    hs = {"Accept":"application/vnd.github+json","Authorization":f"Bearer {token}"}
    if headers: hs.update(headers)
    r = urllib.request.Request(url, data=data, method=method, headers=hs)
    try:
        with urllib.request.urlopen(r) as resp:
            return resp.getcode(), resp.read()
    except urllib.error.HTTPError as e:
        body = e.read()
        try:
            j = json.loads(body.decode() or "{}")
        except Exception:
            j = {"raw": body.decode(errors="ignore")}
        print(f"HTTP {e.code} {url}\n{json.dumps(j, indent=2)}", file=sys.stderr)
        sys.exit(1)

# 1) find or create release for TAG
code, body = req(f"https://api.github.com/repos/{repo}/releases/tags/{tag}")
if code == 200:
    rel = json.loads(body)
else:
    payload = json.dumps({"tag_name":tag,"name":tag,"prerelease":False,"draft":False}).encode()
    code, body = req(f"https://api.github.com/repos/{repo}/releases","POST",payload,{"Content-Type":"application/json"})
    if code not in (200,201):
        print(f"Failed to create release for {tag}", file=sys.stderr); sys.exit(1)
    rel = json.loads(body)

upload_url = rel["upload_url"].split("{")[0]
assets = {a["name"]:a["id"] for a in rel.get("assets", [])}

# 2) upload asset if missing
name = pathlib.Path(pkg).name
if name not in assets:
    with open(pkg, "rb") as f: data = f.read()
    code, _ = req(f"{upload_url}?name={name}", "POST", data, {"Content-Type":"application/gzip"})
    if code not in (200,201): sys.exit(1)
    print(f"ASSET_UPLOADED {name}")
else:
    print(f"ASSET_EXISTS {name}")

print(f"RELEASE_OK tag={tag} repo={repo}")
PY