#!/usr/bin/env bash
set -euo pipefail
API="https://api.github.com"
: "${GITHUB_TOKEN:?Set GITHUB_TOKEN}"; : "${OWNER:?Set OWNER}"; : "${REPO:?Set REPO}"
hdr=(-H "Authorization: token $GITHUB_TOKEN" -H "Accept: application/vnd.github+json")

# A) Validate token (401 means bad/expired token)
code=$(curl -sS -o /tmp/u.json -w '%{http_code}' "${hdr[@]}" "$API/user")
[ "$code" = 200 ] || { echo "Auth failed ($code). Fix token/scopes."; exit 1; }

# B) Check repo access (404 usually = token lacks repo access or OWNER/REPO wrong)
code=$(curl -sS -o /tmp/r.json -w '%{http_code}' "${hdr[@]}" "$API/repos/$OWNER/$REPO")
[ "$code" = 200 ] || { echo "Repo access failed ($code)."; cat /tmp/r.json; exit 1; }

# C) Fetch latest workflow run
code=$(curl -sS -o /tmp/runs.json -w '%{http_code}' "${hdr[@]}" "$API/repos/$OWNER/$REPO/actions/runs?per_page=1")
[ "$code" = 200 ] || { echo "Runs query failed ($code)."; cat /tmp/runs.json; exit 1; }

python - <<'PY'
import json,sys
j=json.load(open("/tmp/runs.json"))
runs=j.get("workflow_runs",[])
if not runs:
    print("No runs yet."); sys.exit(0)
r=runs[0]
print("RUN_ID", r["id"])
print("NAME", r.get("name"))
print("STATUS", r.get("status"))
print("CONCLUSION", r.get("conclusion"))
print("HTML", r.get("html_url"))
PY
