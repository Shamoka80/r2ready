#!/usr/bin/env bash
set -euo pipefail

FIX=${FIX:-./Fixes}
OUTD=${OUTD:-$FIX/reports}
PDF=${PDF:-$FIX/pdf_temp_export.pdf}
COV=${COV:-$OUTD/coverage_report.csv}
XLSX=${XLSX:-$OUTD/coverage_report.xlsx}
OUT=${OUT:-$OUTD/qa_run.txt}
export FIX OUTD PDF COV XLSX OUT

echo "==> Phase 0–3 QA"
bash QA_runner.sh

echo "==> Assert QA pass"
python - <<'PY'
import json, sys, pathlib
p = pathlib.Path("Fixes/reports/qa_run.txt")
j = json.loads(p.read_text()) if p.exists() else {}
ok = bool(j.get("xlsx",{}).get("has_coverage")) and bool(j.get("xlsx",{}).get("cov_colB_listDV")) and not j.get("pdf",{}).get("error")
print("QA ok:", ok)
sys.exit(0 if ok else 1)
PY

echo "==> Phase 4 smoke"
bash Fixes/qa/phase4_smoke.sh

echo "==> Phase 5 smoke"
bash Fixes/qa/phase5_smoke.sh

echo "==> Phase 5 e2e"
bash Fixes/qa/phase5_e2e.sh

echo "==> DONE: Phases 0–5 E2E PASS"
