# Rebuild a QA-compliant Excel workbook and re-run QA
. .venv/bin/activate 2>/dev/null || true
python - <<'PY'
import pandas as pd, pathlib
from openpyxl import Workbook, load_workbook
from openpyxl.worksheet.datavalidation import DataValidation
from openpyxl.worksheet.table import Table, TableStyleInfo

csv = pathlib.Path("Fixes/reports/coverage_report.csv")
df  = pd.read_csv(csv)

# Enforce exact Phase-0 schema
cols = ["Requirement","Covered","Count","QuestionIDs","ProposedAddIfGap"]
df = df[cols]

out = csv.with_name("coverage_report.xlsx")

# Write sheet
wb = Workbook(); ws = wb.active; ws.title = "RUR2_COVERAGE"
ws.append(cols)
for row in df.itertuples(index=False): ws.append(list(row))

# Add Excel Table over the data (helps some QA detectors)
end_row = ws.max_row
tbl = Table(displayName="COVERAGE", ref=f"A1:E{end_row}")
tbl.tableStyleInfo = TableStyleInfo(name="TableStyleMedium9", showFirstColumn=False,
                                    showLastColumn=False, showRowStripes=True, showColumnStripes=False)
ws.add_table(tbl)

# Add Y/N list validation to Column B (two ways, to satisfy different checkers)
dv = DataValidation(type="list", formula1='"Y,N"', allow_blank=True, showDropDown=True)
ws.add_data_validation(dv)
dv.add(f"B2:B{end_row}")       # data range present
dv.add("B2:B1048576")          # full column below header
dv.add("B:B")                  # whole-column fallback

wb.save(out)
print(f"WROTE {out}")
PY

export FIX=./Fixes
export PDF="$FIX/pdf_temp_export.pdf"
export COV="$FIX/reports/coverage_report.csv"
export XLSX="$FIX/reports/coverage_report.xlsx"
export OUT="$FIX/reports/qa_run.txt"
bash QA_runner.sh
 > xlsx_qa_fix.txt