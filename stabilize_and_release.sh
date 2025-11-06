# stabilize_and_release.sh
set -euo pipefail

# Defaults
FIX=${FIX:-./Fixes}
OUTD=${OUTD:-$FIX/reports}
PDF=${PDF:-$FIX/email_temp_export.pdf}
COV=${COV:-$OUTD/coverage_report.csv}
XLSX=${XLSX:-$OUTD/coverage_report.xlsx}
OUT=${OUT:-$OUTD/qa_run.txt}
export FIX OUTD PDF COV XLSX OUT

echo "==> Preflight"
[ -f "$FIX/pdf_temp_export.pdf" ]   || { echo "MISS $FIX/pdf_temp_export.pdf"; exit 1; }
[ -f "$FIX/email_temp_export.pdf" ] || { echo "MISS $FIX/email_temp_export.pdf"; exit 1; }

echo "==> Phases 0–3 QA"
bash QA_runner.sh

echo "==> Phase 4 smoke"
bash Fixes/qa/phase4_smoke.sh

echo "==> Phase 5 smoke + e2e"
bash Fixes/qa/phase5_smoke.sh
bash Fixes/qa/phase5_e2e.sh

echo "==> Phase 6 smoke + e2e"
bash Fixes/qa/phase6_smoke.sh
bash Fixes/qa/phase6_e2e.sh

echo "==> Phase 7 release"
bash phase7_release.sh

echo "==> Cold verify latest package"
LATEST_PKG=$(ls -t releases/rur2_prelaunch_*.tar.gz | head -1)
echo "Verifying package: $LATEST_PKG"
bash coldver.sh "$LATEST_PKG"

echo "==> Cold verify working tree"
bash coldver.sh

echo "==> Git push (tags too)"
git add -f Fixes/pdf_temp_export.pdf Fixes/email_temp_export.pdf || true
git commit -m "stabilize: phases 0–7 re-run, templates ensured" || true
git push -u origin main --tags

echo "ALL GREEN (local). CI will run on GitHub."