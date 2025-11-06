# phase3_run.sh
set -euo pipefail

# --- CONFIG (defaults) ---
FIX="${FIX:-./Fixes}"
PDF="${PDF:-$FIX/pdf_temp_export.pdf}"
OUTD="${OUTD:-$FIX/reports}"
CSV="${COV:-$OUTD/coverage_report.csv}"   # will derive from Phase 2 if missing
XLSX="${XLSX:-$OUTD/coverage_report.xlsx}"
export FIX OUTD CSV XLSX

mkdir -p "$OUTD"

# --- VENV (isolated, no --user) ---
if [ ! -d .venv ]; then
  python3 -m venv .venv
fi
. .venv/bin/activate
export PIP_USER=0 PIP_CONFIG_FILE=/dev/null
python -m pip -q install --upgrade pip setuptools wheel >/dev/null
python -m pip -q install --no-user pandas openpyxl PyPDF2 >/dev/null

# --- SOURCE CSV (Phase 0 schema). If missing, derive from Phase 2 CSV once ---
python - <<'PY'
import pandas as pd, pathlib, os
fix = pathlib.Path(os.environ.get("FIX","./Fixes"))
outd = pathlib.Path(os.environ.get("OUTD", str(fix/"reports")))
csv = pathlib.Path(os.environ.get("CSV", str(outd/"coverage_report.csv")))
if not csv.exists():
    p2 = outd/"phase2_coverage.csv"
    if not p2.exists():
        raise SystemExit(f"Missing CSV: {csv} and no Phase2 CSV at {p2}")
    df = pd.read_csv(p2)  # must contain Requirement, Count (and maybe QuestionIDs)
    if "Covered" not in df.columns:
        df.insert(1, "Covered", df["Count"].gt(0).map({True:"Y", False:"N"}))
    if "QuestionIDs" not in df.columns:
        df["QuestionIDs"] = ""
    df["ProposedAddIfGap"] = df.apply(
        lambda r: f"ADD_{r['Requirement']}_QUESTION" if r["Covered"]=="N" else "", axis=1
    )
    cols = ["Requirement","Covered","Count","QuestionIDs","ProposedAddIfGap"]
    df = df[[*cols, *[c for c in df.columns if c not in cols]]]
    df.to_csv(csv, index=False)
print(f"SOURCE_CSV: {csv}")
PY

# --- BUILD PRODUCTION EXCEL (freeze header, Y/N DV, hidden check col, formatting) ---
python - <<'PY'
import os, pathlib, pandas as pd
from openpyxl import Workbook, load_workbook
from openpyxl.worksheet.datavalidation import DataValidation
from openpyxl.formatting.rule import FormulaRule
from openpyxl.styles import PatternFill

outd  = pathlib.Path(os.environ["OUTD"])
csv   = pathlib.Path(os.environ["CSV"])
xlsx  = pathlib.Path(os.environ["XLSX"])

df = pd.read_csv(csv)

# Ensure core columns
for col in ["Requirement","Covered","Count","QuestionIDs","ProposedAddIfGap"]:
    if col not in df.columns: df[col] = "" if col!="Count" else 0

wb = Workbook()
ws = wb.active
ws.title = "RUR2_COVERAGE"
ws.append(list(df.columns))
for row in df.itertuples(index=False):
    ws.append(list(row))

# Freeze header
ws.freeze_panes = "A2"

# Hidden check column (next empty col): formula OK/MISMATCH
check_col_idx = ws.max_column + 1
ws.cell(row=1, column=check_col_idx, value="Check")
for r in range(2, ws.max_row+1):
    ws.cell(row=r, column=check_col_idx).value = f'=IF(OR(AND(B{r}="Y",C{r}>0),AND(B{r}="N",C{r}=0)),"OK","MISMATCH")'
# Hide it
ws.column_dimensions[ws.cell(row=1, column=check_col_idx).column_letter].hidden = True

# Y/N list validation on Covered (col B)
dv = DataValidation(type="list", formula1='"Y,N"', allow_blank=True)
ws.add_data_validation(dv)
dv.add(f"B2:B{ws.max_row}")

# Conditional formatting:
#   Mismatch -> red fill on entire row
red = PatternFill(start_color="FFC7CE", end_color="FFC7CE", fill_type="solid")
cf_range = f"A2:{ws.cell(row=1, column=ws.max_column).column_letter}{ws.max_row}"
ws.conditional_formatting.add(cf_range, FormulaRule(formula=[f'INDIRECT(ADDRESS(ROW(),{check_col_idx}))="MISMATCH"'], fill=red))

wb.save(xlsx)
print(f"WROTE_XLSX: {xlsx}")
PY

# --- WIRE PDF (copy template into reports for pipeline) ---
cp "$PDF" "$OUTD/export_preview.pdf"

# --- STRICT QA (CSV schema, Excel DV + check col, PDF exists) ---
python - <<'PY'
import json, os, pathlib
import pandas as pd
from openpyxl import load_workbook
from PyPDF2 import PdfReader

fix  = pathlib.Path(os.environ["FIX"])
outd = pathlib.Path(os.environ["OUTD"])
csv  = pathlib.Path(os.environ["CSV"])
xlsx = pathlib.Path(os.environ["XLSX"])
pdf  = fix/"pdf_temp_export.pdf"

res = {"ok": True, "errors": []}

# CSV checks
try:
    df = pd.read_csv(csv)
    need = {"Requirement","Covered","Count","QuestionIDs","ProposedAddIfGap"}
    if not need.issubset(df.columns): raise ValueError("CSV missing required columns")
except Exception as e:
    res["ok"]=False; res["errors"].append(f"CSV: {e}")

# Excel checks
try:
    wb = load_workbook(xlsx, data_only=True)
    assert "RUR2_COVERAGE" in wb.sheetnames, "Missing sheet RUR2_COVERAGE"
    ws = wb["RUR2_COVERAGE"]
    # DV: look for list "Y,N" covering B2:Bmax
    maxr = ws.max_row
    dvs = getattr(ws, "data_validations", None)
    has_dv = False
    if dvs and dvs.dataValidation:
        for dv in dvs.dataValidation:
            if dv.type=="list" and (dv.formula1 or "").strip().replace(" ", "") in {'"Y,N"','="Y,N"'}:
                # ensure B2:Bmax included
                sq = str(dv.sqref).replace(" ", "").split()
                if any(seg.startswith("B2:B") for seg in sq):
                    has_dv = True; break
    assert has_dv, "Covered column lacks Y/N list DV"

    # Hidden Check column with no MISMATCH
    header_row = [c.value for c in ws[1]]
    if "Check" not in header_row:
        raise AssertionError("Missing hidden Check column")
    check_idx = header_row.index("Check")+1
    mismatches = []
    for r in range(2, maxr+1):
        val = ws.cell(row=r, column=check_idx).value
        if (val or "").upper()=="MISMATCH":
            mismatches.append(r)
    assert not mismatches, f"MISMATCH rows: {mismatches}"
except Exception as e:
    res["ok"]=False; res["errors"].append(f"XLSX: {e}")

# PDF check
try:
    rdr = PdfReader(str(pdf))
    assert len(rdr.pages) >= 1, "Empty PDF"
except Exception as e:
    res["ok"]=False; res["errors"].append(f"PDF: {e}")

print("QA:", "PASS" if res["ok"] else "FAIL")
print(json.dumps(res, indent=2))
if not res["ok"]:
    raise SystemExit(1)
PY

echo "DONE Phase 3"