
#!/usr/bin/env bash
set -euo pipefail
FIX="${FIX:-./Fixes}"
OUTD="${OUTD:-$FIX/reports}"
PDF="${PDF:-$FIX/email_temp_export.pdf}"
COV="${COV:-$OUTD/coverage_report.csv}"  # falls back below if missing
mkdir -p "$OUTD"

# venv
if [ ! -d .venv ]; then python3 -m venv .venv; fi
# shellcheck disable=SC1091
source .venv/bin/activate
python - <<'PY'
import os, json, pathlib, datetime
from pathlib import Path

FIX = Path(os.environ.get("FIX","./Fixes"))
OUTD = Path(os.environ.get("OUTD", str(FIX/"reports")))
PDF  = Path(os.environ.get("PDF", str(FIX/"email_temp_export.pdf")))
COV  = Path(os.environ.get("COV", str(OUTD/"coverage_report.csv")))
if not COV.exists():  # fallback
    alt = OUTD/"phase2_coverage.csv"
    if alt.exists(): COV = alt

# deps (inside venv)
import sys, subprocess
def pipi(pkgs): subprocess.check_call([sys.executable,"-m","pip","-q","install",*pkgs])
pipi(["pandas","python-docx","PyPDF2","openpyxl"])

import pandas as pd
from docx import Document
from PyPDF2 import PdfReader

# inputs
pdf_text = ""
if PDF.exists():
    try:
        r = PdfReader(str(PDF))
        pdf_text = "\n".join((p.extract_text() or "") for p in r.pages).strip()
    except Exception as e:
        pdf_text = f"(template read error: {e})"

df = pd.DataFrame()
if COV.exists() and COV.is_file():
    df = pd.read_csv(COV)
    if "Covered" not in df.columns and "Count" in df.columns:
        df.insert(1,"Covered", df["Count"].gt(0).map({True:"Y", False:"N"}))
else:
    # minimal skeleton if coverage missing
    df = pd.DataFrame([{"Requirement":"CR1","Covered":"N","Count":0}])

covered = int((df["Covered"]=="Y").sum())
total   = int(len(df))
gaps    = df.loc[df["Covered"]!="Y","Requirement"].tolist()
today   = datetime.date.today().isoformat()

# emails (basic RFC822)
def write_eml(path: Path, subject: str, body: str):
    path.write_text(
        "Subject: "+subject+"\n"
        "Content-Type: text/plain; charset=utf-8\n"
        "\n"+body,
        encoding="utf-8"
    )

lead = (pdf_text.splitlines()[0] if pdf_text else "RUR2 Communications Template")

summary_block = (
    f"{lead}\n\n"
    f"Date: {today}\n"
    f"Coverage: {covered}/{total} requirements marked Covered.\n"
    f"Gaps: {', '.join(gaps) if gaps else 'None'}\n"
)

write_eml(OUTD/"rur2_auditor_draft.eml",
          f"RUR2 Coverage Summary — {covered}/{total} covered",
          summary_block + "\nThis is the auditor-facing draft based on your template.")

write_eml(OUTD/"rur2_internal_draft.eml",
          f"[Internal] RUR2 Coverage — {covered}/{total} (gaps: {len(gaps)})",
          summary_block + "\nInternal notes: review gaps before export.")

# exec summary docx
doc = Document()
doc.add_heading('RUR2 Executive Summary', 0)
doc.add_paragraph(lead)
doc.add_paragraph(f"Date: {today}")
doc.add_paragraph(f"Coverage: {covered}/{total}")
doc.add_paragraph("Gaps: " + (", ".join(gaps) if gaps else "None"))

# small table
tbl = doc.add_table(rows=1, cols=3)
hdr = tbl.rows[0].cells
hdr[0].text, hdr[1].text, hdr[2].text = "Requirement","Covered","Count"
for _, r in df.iterrows():
    row = tbl.add_row().cells
    row[0].text = str(r.get("Requirement",""))
    row[1].text = str(r.get("Covered",""))
    row[2].text = str(r.get("Count",""))

doc.save(OUTD/"exec_summary.docx")

print(json.dumps({
  "wrote": [str(OUTD/"rur2_auditor_draft.eml"),
            str(OUTD/"rur2_internal_draft.eml"),
            str(OUTD/"exec_summary.docx")],
  "pdf_used": PDF.exists(),
  "cov_used": str(COV)
}, indent=2))
PY
