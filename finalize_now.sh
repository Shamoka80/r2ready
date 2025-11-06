# finalize_now.sh
#!/usr/bin/env bash
set -euo pipefail

TAG="${1:-prelaunch-20250921090651}"
REPO="${OWNER_REPO:-Shamoka80/R2v3APP}"
: "${GITHUB_TOKEN:?GITHUB_TOKEN is not set in env}"

# Ensure a package exists
PKG="$(ls -t releases/rur2_prelaunch_*.tar.gz 2>/dev/null | head -1 || true)"
if [ -z "${PKG}" ]; then
  echo "No package found; building one via phase7_release.sh…"
  bash phase7_release.sh
  PKG="$(ls -t releases/rur2_prelaunch_*.tar.gz | head -1)"
fi
echo "Using package: $PKG"
export PKG

python - <<'PY'
import os, json, sys, urllib.request, urllib.error

repo  = os.environ['REPO']
tag   = os.environ['TAG']
pkg   = os.environ['PKG']
token = os.environ['GITHUB_TOKEN']

def req(url, method="GET", data=None, headers=None):
    hs = {
        "Accept": "application/vnd.github+json",
        "Authorization": f"Bearer {token}",
        "X-GitHub-Api-Version": "2022-11-28",
        "User-Agent": "r2v3app-finalizer"
    }
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

# get or create release for TAG
code, body = req(f"https://api.github.com/repos/{repo}/releases/tags/{tag}")
if code == 200:
    rel = json.loads(body)
else:
    payload = json.dumps({"tag_name": tag, "name": tag, "draft": False, "prerelease": False}).encode()
    code, body = req(f"https://api.github.com/repos/{repo}/releases", "POST", payload, {"Content-Type":"application/json"})
    rel = json.loads(body)

upload_url = rel["upload_url"].split("{",1)[0]
assets = {a["name"]: a["id"] for a in rel.get("assets", [])}

name = os.path.basename(pkg)
if name in assets:
    print(f"ASSET_EXISTS {name}")
else:
    with open(pkg, "rb") as f:
        data = f.read()
    code, _ = req(f"{upload_url}?name={name}", "POST", data, {"Content-Type":"application/gzip"})
    if code not in (200,201):
        sys.exit(1)
    print(f"ASSET_UPLOADED {name}")

print(f"RELEASE_OK tag={tag} repo={repo}")
PY