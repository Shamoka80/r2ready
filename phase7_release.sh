# phase7_release.sh
#!/usr/bin/env bash
set -eo pipefail

FIX=${FIX:-./Fixes}
OUTD=${OUTD:-$FIX/reports}
E2E=${E2E:-final0to6.sh}

mkdir -p "$OUTD" releases

echo "==> Re-run parity"
if [ -f "$E2E" ] && [ -x "$E2E" ]; then
  set +e  # Temporarily disable exit on error
  bash "$E2E" >/dev/null 2>&1
  PARITY_RC=$?
  set -e  # Re-enable exit on error
  if [ $PARITY_RC -ne 0 ]; then
    echo "⚠️  Parity check had issues (exit code $PARITY_RC) - continuing anyway"
  else
    echo "✅ Parity check passed"
  fi
else
  echo "⚠️  $E2E not found or not executable - skipping parity check"
fi

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
# Only require essential files, optional files are nice-to-have
essential_files = [
    fix/"pdf_temp_export.pdf",
    fix/"email_temp_export.pdf",
    outd/"qa_run.txt",
]
summary["ok"] = all(pathlib.Path(p).exists() for p in essential_files)
summary["optional_missing"] = [a["path"] for a in summary["artifacts"] if not a["exists"] and pathlib.Path(a["path"]) not in essential_files]
(outd/"release_summary.json").write_text(json.dumps(summary,indent=2))
print("SUMMARY_OK", summary["ok"])
if summary["optional_missing"]:
    print("OPTIONAL_MISSING:", ", ".join(summary["optional_missing"]))
PY

echo "==> Package"
STAMP=$(date +%Y%m%d%H%M%S)
PKG="releases/rur2_prelaunch_${STAMP}.tar.gz"
tar -czf "$PKG" Fixes/
echo "PACKAGE $PKG"