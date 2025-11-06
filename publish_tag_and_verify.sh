# publish_tag_and_verify.sh
#!/usr/bin/env bash
set -euo pipefail

# 0) Resolve repo owner/name from 'origin'
REMOTE="$(git remote get-url origin 2>/dev/null || true)"
[ -n "$REMOTE" ] || { echo "No 'origin' remote configured."; exit 1; }
OWNER_REPO="$(echo "$REMOTE" | sed -E 's#(git@github.com:|https?://github.com/)([^/]+/[^.]+)(\.git)?#\2#')"

# 1) Create & push a new tag to trigger publish workflow
TAG="prelaunch-$(date +%Y%m%d%H%M%S)"
git tag -a "$TAG" -m "RUR2 prelaunch"
git push origin "$TAG"
echo "→ Pushed tag: $TAG"

# 2) Poll GitHub Releases for this tag, then download .tar.gz and cold-verify
PY=$(mktemp)
cat >"$PY"<<'PY'
import os, sys, time, json, urllib.request, shutil, tempfile, ssl
owner_repo=os.environ["OWNER_REPO"]; tag=os.environ["TAG"]
token=os.environ.get("GITHUB_TOKEN","")
api=f"https://api.github.com/repos/{owner_repo}"
hdr={"User-Agent":"RUR2","Accept":"application/vnd.github+json"}
if token: hdr["Authorization"]=f"Bearer {token}"
ctx=ssl.create_default_context()

def req(url):
    try:
        r=urllib.request.urlopen(urllib.request.Request(url,headers=hdr), context=ctx, timeout=15)
        return r.getcode(), r.read().decode()
    except Exception as e:
        code=getattr(e,'code',0) or 0
        return code, ""

# wait up to ~5 minutes (30 * 10s)
for i in range(30):
    code, body = req(f"{api}/releases/tags/{tag}")
    if code==200:
        rel=json.loads(body)
        assets=rel.get("assets",[])
        tgz=None
        for a in assets:
            name=a.get("name","")
            if name.endswith(".tar.gz"):
                tgz=a.get("browser_download_url")
                break
        if tgz:
            d=tempfile.mkdtemp()
            out=os.path.join(d,"release.tgz")
            with urllib.request.urlopen(urllib.request.Request(tgz,headers=hdr), context=ctx) as r, open(out,"wb") as f:
                shutil.copyfileobj(r,f)
            print(out)
            sys.exit(0)
        else:
            # release exists but asset not uploaded yet
            time.sleep(10)
            continue
    time.sleep(10)

print("TIMEOUT_NO_RELEASE", flush=True)
sys.exit(0)
PY

OUT="$(OWNER_REPO="$OWNER_REPO" TAG="$TAG" python "$PY" || true)"
if [[ "$OUT" == TIMEOUT_NO_RELEASE ]]; then
  echo "Timed out waiting for Release. Check Actions: https://github.com/$OWNER_REPO/actions"
  exit 1
fi

if [ -f "$OUT" ]; then
  echo "PKG: $OUT"
  bash coldver.sh "$OUT"
  echo "DONE ✅"
else
  echo "No package downloaded. Check Release for tag: $TAG"
  exit 1
fi