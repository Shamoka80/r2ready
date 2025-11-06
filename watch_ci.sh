# watch_ci.sh
set -euo pipefail
OWNER="${OWNER:-Shamoka80}"
REPO="${REPO:-R2v3APP}"
WF="${WF:-ci.yml}"
BR="${BR:-main}"
URL="https://api.github.com/repos/$OWNER/$REPO/actions/workflows/$WF/runs?branch=$BR&per_page=1"
AUTH=()
[ -n "${GITHUB_TOKEN:-}" ] && AUTH=(-H "Authorization: Bearer $GITHUB_TOKEN")

echo "Watching $OWNER/$REPO :: $WF @$BR"
end=$((SECONDS+900)); last=""
while (( SECONDS < end )); do
  json=$(curl -fsSL "${AUTH[@]}" -H "Accept: application/vnd.github+json" "$URL" || true)
  status=$(python - <<'PY'
import json,sys
try:
  j=json.load(sys.stdin); runs=j.get("workflow_runs",[])
  if not runs: print("pending|"); sys.exit(0)
  r=runs[0]; print(f"{(r.get('conclusion') or r.get('status'))}|{r.get('html_url')}")
except Exception: print("pending|")
PY
<<<"$json")
  st="${status%%|*}"; link="${status#*|}"
  if [[ "$st" != "$last" ]]; then echo "CI: $st ${link:+-> $link}"; last="$st"; fi
  case "$st" in success) exit 0;; failure|cancelled|timed_out) exit 1;; esac
  sleep 10
done
echo "Timed out; open: https://github.com/$OWNER/$REPO/actions"; exit 1
