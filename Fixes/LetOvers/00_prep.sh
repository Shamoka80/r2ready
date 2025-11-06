#!/usr/bin/env bash
set -euo pipefail
echo "== prep =="

# dirs
mkdir -p ./Fixes/reports ./Fixes/backup

# inputs
if ! ls ./Fixes/questions*.csv >/dev/null 2>&1; then
  echo "ERR: No questions CSV under ./Fixes/ (expected questions.csv or questions_fixed.csv)"; exit 1
fi

# optional PDF
if [ -f ./Fixes/pdf_temp_export.pdf ]; then
  echo "OK: PDF template found"
else
  echo "WARN: ./Fixes/pdf_temp_export.pdf not found (Phase 3 wiring can still proceed later)"
fi

echo "OK"