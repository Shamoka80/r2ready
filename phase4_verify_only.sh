# save as: phase4_verify_only.sh
set -euo pipefail

FIX=${FIX:-./Fixes}
OUTD=${OUTD:-"$FIX/reports"}
PDF=${PDF:-"$FIX/email_temp_export.pdf"}
COV=${COV:-"$OUTD/coverage_report.csv"}
XLSX=${XLSX:-"$OUTD/coverage_report.xlsx"}

aud="$OUTD/rur2_auditor_draft.eml"
int="$OUTD/rur2_internal_draft.eml"
doc="$OUTD/exec_summary.docx"

exists() { [ -f "$1" ] && echo true || echo false; }

# find potential user-provided templates (we do NOT generate)
mapfile -t eml_tpl < <(find "$FIX" -maxdepth 3 -type f \( -iname "*auditor*.eml" -o -iname "*internal*.eml" -o -iname "*.eml" -o -iname "*.msg" -o -iname "*.html" \) 2>/dev/null | sort)
mapfile -t docx_tpl < <(find "$FIX" -maxdepth 3 -type f \( -iname "*exec*summary*.docx" -o -iname "*summary*.docx" -o -iname "*exec*.docx" \) 2>/dev/null | sort)

# inputs present?
pdf_ok=$(exists "$PDF")
csv_ok=$(exists "$COV")
xlsx_ok=$(exists "$XLSX")

# expected outputs present?
aud_ok=$(exists "$aud")
int_ok=$(exists "$int")
doc_ok=$(exists "$doc")

# print JSON (no jq)
printf '{\n'
printf '  "inputs": {"pdf":"%s","csv":"%s","xlsx":"%s"},\n' "$pdf_ok" "$csv_ok" "$xlsx_ok"
printf '  "existing_outputs": {"auditor_eml":"%s","internal_eml":"%s","exec_summary_docx":"%s"},\n' "$aud_ok" "$int_ok" "$doc_ok"

printf '  "template_candidates": {\n'
printf '    "email_like": ['
first=1; for f in "${eml_tpl[@]}"; do [ -z "${f:-}" ] && continue; [ $first -eq 1 ] || printf ', '; printf '"%s"' "$f"; first=0; done; printf '],\n'
printf '    "docx_like": ['
first=1; for f in "${docx_tpl[@]}"; do [ -z "${f:-}" ] && continue; [ $first -eq 1 ] || printf ', '; printf '"%s"' "$f"; first=0; done; printf ']\n'
printf '  },\n'

# recommendation logic (no generation)
rec="hold"
reason="Missing inputs"; $pdf_ok && $csv_ok && rec="ready"; $pdf_ok && $csv_ok || true
$aud_ok && $int_ok && $doc_ok && rec="skip"

printf '  "recommendation": {"action":"%s","notes":"' "$rec"
if [ "$rec" = "skip" ]; then
  printf 'Artifacts already exist; do not overwrite.'
elif [ "$rec" = "ready" ]; then
  printf 'Inputs present; safe to generate ONLY IF no templates above should be used instead.'
else
  printf 'Provide/confirm inputs: PDF=%s CSV=%s.' "$PDF" "$COV"
fi
printf '"}\n}\n'