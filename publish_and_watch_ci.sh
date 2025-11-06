# publish_and_watch_ci.sh
set -euo pipefail

OWNER=${OWNER:-Shamoka80}
REPO=${REPO:-R2v3APP}
WF=${WF:-ci.yml}

echo "==> Build latest package with templates (permanent fix)"
bash phase7_release.sh

echo "==> Verify templates are included"
PKG=$(ls -t releases/rur2_prelaunch_*.tar.gz | head -1)
[ -f "$PKG" ] || { echo "No package found"; exit 1; }
echo "PKG: $PKG"

# Verify templates are included in package
echo "Verifying templates in package..."
tar -tzf "$PKG" | grep -E "(pdf_temp_export|email_temp_export)" || { echo "Templates missing from package!"; exit 1; }
echo "✓ Templates confirmed in package"

# Cold verify the package
bash coldver.sh "$PKG"

TAG="prelaunch-$(date +%Y%m%d%H%M%S)"
TITLE="RUR2 Prelaunch $(date -u +%F)"
BODY="Automated release (templates included). Package: $(basename "$PKG")"

create_release_api() {
  echo "==> Creating GitHub Release via API ($TAG)"
  rel_json=$(curl -fsSL -X POST \
    -H "Authorization: Bearer $GITHUB_TOKEN" \
    -H "Accept: application/vnd.github+json" \
    "https://api.github.com/repos/$OWNER/$REPO/releases" \
    -d @- <<JSON
{"tag_name":"$TAG","name":"$TITLE","body":"$BODY","draft":false,"prerelease":true,"target_commitish":"main"}
JSON
  )
  upload_url=$(python - <<'PY'
import json,sys; j=json.load(sys.stdin); print(j.get("upload_url","").split("{")[0])
PY
<<<"$rel_json")
  [ -n "$upload_url" ] || { echo "Release API did not return upload_url"; exit 1; }
  echo "==> Uploading asset"
  curl -fsSL -X POST \
    -H "Authorization: Bearer $GITHUB_TOKEN" \
    -H "Content-Type: application/gzip" \
    "$upload_url?name=$(basename "$PKG")" \
    --data-binary @"$PKG" >/dev/null
  echo "Release created: https://github.com/$OWNER/$REPO/releases/tag/$TAG"
}

create_release_gh() {
  echo "==> Creating GitHub Release via gh ($TAG)"
  gh release create "$TAG" "$PKG" -t "$TITLE" -n "$BODY" --prerelease
}

if command -v gh >/dev/null 2>&1; then
  create_release_gh || { echo "gh path failed, trying API…"; [ -n "${GITHUB_TOKEN:-}" ] && create_release_api || { echo "No GITHUB_TOKEN available for API fallback. Set GITHUB_TOKEN (scopes: repo, workflow) and OWNER/REPO."; exit 1; }; }
elif [ -n "${GITHUB_TOKEN:-}" ]; then
  create_release_api
else
  echo "ERROR: GITHUB_TOKEN not set and gh unavailable. Local git operations are disabled in this environment."
  echo "SOLUTION: Set GITHUB_TOKEN (scopes: repo, workflow) and ensure OWNER/REPO are correct."
  echo "OWNER=$OWNER, REPO=$REPO"
  exit 1
fi

echo "==> Watch CI for $WF on main"
python - <<'PY'
import json,sys,time,urllib.request,urllib.error,os
owner=os.environ.get("OWNER"); repo=os.environ.get("REPO"); wf=os.environ.get("WF","ci.yml")
url=f"https://api.github.com/repos/{owner}/{repo}/actions/workflows/{wf}/runs?branch=main&per_page=1"
hdrs={"Accept":"application/vnd.github+json"}
tok=os.environ.get("GITHUB_TOKEN"); 
if tok: hdrs["Authorization"]=f"Bearer {tok}"
def fetch():
    req=urllib.request.Request(url,headers=hdrs)
    with urllib.request.urlopen(req,timeout=15) as r:
        return json.load(r)
def status():
    try:
        j=fetch()
        runs=j.get("workflow_runs",[])
        if not runs: return ("pending",None)
        run=runs[0]; return (run.get("conclusion") or run.get("status"), run.get("html_url"))
    except urllib.error.HTTPError as e:
        print(f"CI watch HTTP {e.code}; open Actions: https://github.com/{owner}/{repo}/actions", flush=True)
        sys.exit(0)
    except Exception as e:
        print(f"CI watch error: {e}", flush=True); return ("pending",None)
deadline=time.time()+900
last=None
while time.time()<deadline:
    st,link=status()
    if st!=last:
        print(f"CI status: {st}{' -> ' + link if link else ''}", flush=True)
        last=st
    if st in ("success","failure","cancelled","timed_out","neutral","skipped","action_required"):
        sys.exit(0 if st=="success" else 1)
    time.sleep(10)
print("CI watch timeout (15m). Check: https://github.com/{}/{}//actions".format(owner,repo))
sys.exit(1)
PY