# phase7_release.sh
#!/usr/bin/env bash
set -euo pipefail

FIX=${FIX:-./Fixes}
OUTD=${OUTD:-$FIX/reports}
E2E=${E2E:-final0to6.sh}

mkdir -p "$OUTD" releases

echo "==> Re-run parity"
bash "$E2E" >/dev/null

echo "==> Build release summary"
python - <<'PY'
import json, os, pathlib, time, hashlib
fix=pathlib.Path(os.environ.get("FIX","./Fixes"))
outd=pathlib.Path(os.environ.get("OUTD","./Fixes/reports"))
files=[
  outd/"coverage_report.csv",
  outd/"coverage_report.xlsx",
  fix/"pdf_temp_export.pdf",
  fix/"email_temp_export.pdf",
  outd/"rur2_auditor_draft.eml",
  outd/"rur2_internal_draft.eml",
  outd/"exec_summary.docx",
  outd/"credits_ledger.json",
  outd/"security_e2e.json",
  outd/"qa_run.txt",
  fix/"api/openapi_byoc.yaml",
  fix/"api/openapi_credits.yaml",
  fix/"contracts/byoc_contracts.ts",
  fix/"contracts/stripe_credits.ts",
  fix/"migrations/001_byoc.sql",
  fix/"migrations/002_credits.sql",
]
def sha(p):
  h=hashlib.sha256()
  with open(p,"rb") as f:
    for chunk in iter(lambda:f.read(1<<20), b""): h.update(chunk)
  return h.hexdigest()

summary={"ok":True,"generated_at":time.strftime("%Y-%m-%d %H:%M:%S"),
         "artifacts":[]}
for p in files:
  p=pathlib.Path(p)
  summary["artifacts"].append({
    "path":str(p),
    "exists":p.exists(),
    "size":(p.stat().st_size if p.exists() else 0),
    "sha256":(sha(p) if p.exists() and p.is_file() else None)
  })
summary["ok"] = all(a["exists"] for a in summary["artifacts"])
(outd/"release_summary.json").write_text(json.dumps(summary,indent=2))
print("SUMMARY_OK", summary["ok"])
PY

echo "==> Package"
STAMP=$(date +%Y%m%d%H%M%S)
PKG="releases/rur2_prelaunch_${STAMP}.tar.gz"
tar -czf "$PKG" Fixes/
echo "PACKAGE $PKG"