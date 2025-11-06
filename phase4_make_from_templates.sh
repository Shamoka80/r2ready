# phase4_make_from_templates.sh
set -euo pipefail
FIX=${FIX:-./Fixes}
OUTD=${OUTD:-$FIX/reports}
PDF_EMAIL=${PDF_EMAIL:-$FIX/email_temp_export.pdf}
PDF_SUMMARY=${PDF_SUMMARY:-$FIX/pdf_temp_export.pdf}
CSV=${CSV:-$OUTD/coverage_report.csv}
XLSX=${XLSX:-$OUTD/coverage_report.xlsx}
mkdir -p "$OUTD"

# verify inputs exist
for p in "$PDF_EMAIL" "$PDF_SUMMARY" "$CSV" "$XLSX"; do
  [ -f "$p" ] || { echo "MISS $p"; exit 1; }
done

# brief coverage line for emails
COV_LINE=$(python - <<'PY'
import os, pandas as pd
df=pd.read_csv(os.environ["CSV"])
covered=(df["Covered"]=="Y").sum(); total=len(df)
gaps=df.loc[df["Covered"]!="Y","Requirement"].tolist()
print(f"covered={covered}/{total}; gaps={','.join(gaps) or 'none'}")
PY
)

# EML drafts (reference your PDF email layout)
cat > "$OUTD/rur2_auditor_draft.eml" <<EOF
From: noreply@rur2.local
To: auditor@example.com
Subject: RUR2 Coverage Summary (draft)
Content-Type: text/plain; charset=UTF-8

This draft follows the approved layout in: $PDF_EMAIL
Coverage: $COV_LINE

Attachments expected (not embedded):
 - $XLSX
 - $CSV
 - $PDF_SUMMARY (exec summary layout reference)
EOF

cat > "$OUTD/rur2_internal_draft.eml" <<EOF
From: noreply@rur2.local
To: internal@example.com
Subject: RUR2 Coverage Summary (draft, internal)
Content-Type: text/plain; charset=UTF-8

This draft follows the approved layout in: $PDF_EMAIL
Coverage: $COV_LINE

Attachments expected (not embedded):
 - $XLSX
 - $CSV
 - $PDF_SUMMARY (exec summary layout reference)
EOF

# DOCX exec summary (simple shell; layout reference points to your PDF)
VENV=.venv
[ -d "$VENV" ] || python -m venv "$VENV"
. "$VENV/bin/activate"
export PIP_USER=0 PIP_CONFIG_FILE=/dev/null
pip -q install --upgrade pip setuptools wheel >/dev/null
pip -q install --no-user python-docx >/dev/null

DOCX="$OUTD/exec_summary.docx"
python - <<'PY'
from docx import Document
from docx.shared import Pt
import os, datetime
doc=Document()
doc.add_heading('RUR2 Executive Summary (Draft)', 0)
doc.add_paragraph(f"Layout reference: {os.environ['PDF_SUMMARY']}")
doc.add_paragraph(f"Coverage CSV: {os.environ['CSV']}")
doc.add_paragraph(f"Generated: {datetime.datetime.utcnow().isoformat()}Z")
doc.save(os.environ['DOCX'])
PY

echo "WROTE $OUTD/rur2_auditor_draft.eml"
echo "WROTE $OUTD/rur2_internal_draft.eml"
echo "WROTE $DOCX"