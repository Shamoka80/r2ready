
#!/usr/bin/env bash
set -euo pipefail
OUTD="${OUTD:-./Fixes/reports}"
EMLS=( "$OUTD"/rur2_auditor_draft.eml "$OUTD"/rur2_internal_draft.eml )
DOCX="$OUTD/exec_summary.docx"

ok=1
for f in "${EMLS[@]}"; do
  if [[ ! -s "$f" ]]; then echo "MISS $f"; ok=0; fi
  if grep -q "{{" "$f" 2>/dev/null; then echo "TPL_PLACEHOLDERS $f"; ok=0; fi
done
if [[ ! -s "$DOCX" ]]; then echo "MISS $DOCX"; ok=0; fi

if [[ $ok -eq 1 ]]; then
  echo "PHASE4_SMOKE: PASS"
else
  echo "PHASE4_SMOKE: FAIL"
  exit 1
fi
