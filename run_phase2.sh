#!/usr/bin/env bash
set -euo pipefail
export FIX="${FIX:-./Fixes}"
export QCSV="${QCSV:-$FIX/questions.csv}"
export OUT="${OUT:-$FIX/reports}"
python3 "$FIX/engine/engine_cli.py"
echo "==> artifacts:"
ls -1 "$OUT"/phase2_*.*
