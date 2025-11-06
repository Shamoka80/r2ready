cat > phase0_part1.sh <<'BASH'
set -euo pipefail

ROOT="${PWD}"
FIXES="${ROOT}/Fixes"
QS="${FIXES}/questions.csv"
PDF="${FIXES}/pdf_temp_export.pdf"
OUT="${FIXES}/reports"
mkdir -p "$OUT" "$FIXES/.backup"

[[ -f "$QS" && -f "$PDF" ]] || { echo "❌ Missing $QS or $PDF"; exit 1; }
cp -n "$QS" "$FIXES/.backup/questions.$(date +%Y%m%d%H%M%S).csv" || true

echo "OK: found $QS"
echo "OK: found $PDF"
echo "OK: backups + folders ready ($OUT)"
BASH
bash phase0_part1.sh
