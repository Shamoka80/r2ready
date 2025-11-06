# continue_launch.sh
#!/usr/bin/env bash
set -euo pipefail

# --- Config (uses defaults if not set) ---
export FIX=${FIX:-./Fixes}
export OUTD=${OUTD:-$FIX/reports}
export PDF=${PDF:-$FIX/email_temp_export.pdf}
export COV=${COV:-$OUTD/coverage_report.csv}
export XLSX=${XLSX:-$OUTD/coverage_report.xlsx}
export OUT=${OUT:-$OUTD/qa_run.txt}

echo "==> 0) Preflight: templates present?"
[ -f "$FIX/pdf_temp_export.pdf" ] && [ -f "$FIX/email_temp_export.pdf" ] || {
  echo "Missing template PDFs under $FIX"; exit 1; }

echo "==> 1) QA (Phases 0–3)"
bash QA_runner.sh
python - <<'PY'
import json,sys,pathlib
p=pathlib.Path("Fixes/reports/qa_run.txt")
j=json.loads(p.read_text()) if p.exists() else {}
ok=(j.get("xlsx",{}).get("has_coverage") and
    j.get("xlsx",{}).get("cov_colB_listDV") and
    not j.get("pdf",{}).get("error"))
print("QA ok:", bool(ok)); sys.exit(0 if ok else 1)
PY

echo "==> 2) Phases 4–6 checks"
bash Fixes/qa/phase4_smoke.sh
bash Fixes/qa/phase5_smoke.sh
bash Fixes/qa/phase5_e2e.sh
bash Fixes/qa/phase6_smoke.sh
bash Fixes/qa/phase6_e2e.sh

echo "==> 3) Build package (Phase 7)"
bash phase7_release.sh
PKG=$(ls -t releases/rur2_prelaunch_*.tar.gz | head -1)
echo "PKG $PKG"

echo "==> 4) Cold verify package"
bash coldver.sh "$PKG"

echo "==> 5) Promote to launch tag (optional)"
if git rev-parse --git-dir >/dev/null 2>&1; then
  TAG="launch-$(date +%Y%m%d%H%M%S)"
  git tag -f "$TAG"
  if git remote get-url origin >/dev/null 2>&1; then git push -f origin "$TAG" || true; fi
  echo "TAGGED $TAG"
fi

echo "==> DONE"
