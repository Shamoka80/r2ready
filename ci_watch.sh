
#!/usr/bin/env bash
set -euo pipefail
REPO="${REPO:-Shamoka80/R2v3APP}"   # owner/repo
WF="${WF:-ci.yml}"                  # workflow file name
BR="${BR:-main}"                    # branch
POLL="${POLL:-10}"                  # seconds between checks
TIMEOUT="${TIMEOUT:-900}"           # max seconds to wait

echo "Watching CI for $REPO :: $WF @ $BR"
start=$(date +%s)
while :; do
  JSON=$(python - <<'PY'
import json, os, sys, urllib.request
repo = os.environ.get("REPO","")
wf   = os.environ.get("WF","")
br   = os.environ.get("BR","")
url  = f"https://api.github.com/repos/{repo}/actions/workflows/{wf}/runs?branch={br}&per_page=1"
hdrs = {"Accept":"application/vnd.github+json"}
tok  = os.environ.get("GITHUB_TOKEN") or os.environ.get("GH_TOKEN")
if tok: hdrs["Authorization"] = f"Bearer {tok}"
req = urllib.request.Request(url, headers=hdrs)
with urllib.request.urlopen(req) as r:
    j = json.load(r)
run = (j.get("workflow_runs") or [{}])[0]
print(json.dumps({
  "id": run.get("id"),
  "status": run.get("status"),
  "conclusion": run.get("conclusion"),
  "html_url": run.get("html_url"),
}))
PY
  ) || { echo "GitHub API call failed"; exit 2; }

  status=$(printf '%s' "$JSON" | python -c 'import sys,json; print((json.load(sys.stdin) or {}).get("status"))')
  concl=$( printf '%s' "$JSON" | python -c 'import sys,json; print((json.load(sys.stdin) or {}).get("conclusion"))')
  url=$(   printf '%s' "$JSON" | python -c 'import sys,json; print((json.load(sys.stdin) or {}).get("html_url"))')

  echo "status=${status:-n/a} conclusion=${concl:-n/a}  ${url:-n/a}"

  if [ "${status:-}" = "completed" ]; then
    [ "${concl:-}" = "success" ] && exit 0 || exit 1
  fi

  now=$(date +%s); (( now-start >= TIMEOUT )) && { echo "Timed out."; exit 2; }
  sleep "$POLL"
done
