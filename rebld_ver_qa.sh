# Rebuild Excel with absolute DV range, verify, then run QA
. .venv/bin/activate 2>/dev/null || true
python - <<'PY'
from openpyxl import Workbook, load_workbook
from openpyxl.worksheet.datavalidation import DataValidation
import pandas as pd, pathlib, json

csv = pathlib.Path("Fixes/reports/coverage_report.csv")
df  = pd.read_csv(csv)

# Ensure required schema for QA
need = ["Requirement","Covered","Count","QuestionIDs","ProposedAddIfGap"]
for c in need:
    if c not in df.columns: raise SystemExit(f"Missing column: {c}")

# Build XLSX
out = csv.with_name("coverage_report.xlsx")
wb  = Workbook(); ws = wb.active; ws.title = "RUR2_COVERAGE"
ws.append(need)
for r in df[need].itertuples(index=False): ws.append(list(r))

end = ws.max_row
dv  = DataValidation(type="list", formula1='"Y,N"', allow_blank=True, showDropDown=True)
ws.add_data_validation(dv)
dv.add(f"$B$2:$B${end}")  # absolute range only

wb.save(out)

# Verify what QA will likely check
wb2 = load_workbook(out, data_only=True)
ws2 = wb2["RUR2_COVERAGE"]
report = {
  "headers": [c.value for c in ws2[1]],
  "row_count": ws2.max_row-1,
  "B_sample": [ws2[f"B{i}"].value for i in range(2, min(12, ws2.max_row)+1)],
  "DVs": [(d.type, d.formula1, str(d.sqref)) for d in ws2.data_validations.dataValidation],
}
print(json.dumps(report, indent=2))
PY

export FIX=./Fixes
export PDF="$FIX/pdf_temp_export.pdf"
export COV="$FIX/reports/coverage_report.csv"
export XLSX="$FIX/reports/coverage_report.xlsx"
export OUT="$FIX/reports/qa_run.txt"
bash QA_runner.sh
 > rebld_ver_qa.txt