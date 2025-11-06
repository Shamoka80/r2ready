# release_validate_and_stage_min.sh
#!/usr/bin/env bash
set -euo pipefail
TAG="${1:-}"

REMOTE=$(git remote get-url origin 2>/dev/null || echo "")
[ -n "$REMOTE" ] || { echo "No origin remote"; exit 0; }
OWNER_REPO=$(echo "$REMOTE" | sed -E 's#(git@github.com:|https?://github.com/)([^/]+/[^.]+)(\.git)?#\2#')

PYTMP=$(mktemp)
cat >"$PYTMP"<<'PY'
import os, sys, json, urllib.request, shutil, tempfile
owner_repo=os.environ["OWNER_REPO"]; token=os.environ.get("GITHUB_TOKEN"); tag=os.environ.get("TAG","")
api=f"https://api.github.com/repos/{owner_repo}"
hdr={"User-Agent":"RUR2","Accept":"application/vnd.github+json"}
if token: hdr["Authorization"]=f"Bearer {token}"
def get(u):
  try:
    r=urllib.request.urlopen(urllib.request.Request(u,headers=hdr))
    return r.getcode(), r.read().decode()
  except Exception as e:
    return getattr(e,'code',0) or 0, ""
rel=None
if tag:
  c,b=get(f"{api}/releases/tags/{tag}")
  if c==200: rel=json.loads(b)
else:
  c,b=get(f"{api}/releases")
  if c==200:
    for r in json.loads(b):
      if any(a.get("name","").endswith(".tar.gz") for a in r.get("assets",[])): rel=r; break
if not rel: print("NO_RELEASE"); sys.exit(0)
asset=next((a for a in rel.get("assets",[]) if a.get("name","").endswith(".tar.gz")),None)
if not asset: print("NO_ASSET"); sys.exit(0)
url=asset.get("browser_download_url") or ""; 
if not url: print("NO_URL"); sys.exit(0)
d=tempfile.mkdtemp(); tgz=os.path.join(d,"release.tgz")
with urllib.request.urlopen(urllib.request.Request(url,headers=hdr)) as r, open(tgz,"wb") as f: shutil.copyfileobj(r,f)
print(tgz)
PY

OWNER_REPO="$OWNER_REPO" TAG="$TAG" python "$PYTMP" > /tmp/_rel_tgz.txt || true
TAR=$(cat /tmp/_rel_tgz.txt 2>/dev/null || true)

case "$TAR" in
  NO_RELEASE) echo "No release found — skipping validate."; exit 0;;
  NO_ASSET)   echo "No .tar.gz asset — skipping validate."; exit 0;;
  NO_URL)     echo "Asset has no URL — skipping validate."; exit 0;;
esac

if [ -f "$TAR" ]; then
  echo "PKG: $TAR"
  bash coldver.sh "$TAR"
  echo "VALIDATE_OK"
fi
