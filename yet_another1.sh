# Strict Excel rebuild (named range + hidden sheet + table) then QA
. .venv/bin/activate 2>/dev/null || true
python - <<'PY'
import pandas as pd, pathlib, json
from openpyxl import Workbook, load_workbook
from openpyxl.worksheet.datavalidation import DataValidation
from openpyxl.worksheet.table import Table, TableStyleInfo
from openpyxl.workbook.defined_name import DefinedName

csv = pathlib.Path("Fixes/reports/coverage_report.csv")
df  = pd.read_csv(csv)

need = ["Requirement","Covered","Count","QuestionIDs","ProposedAddIfGap"]
df = df[need] if all(c in df.columns for c in need) else (_ for _ in ()).throw(SystemExit("coverage_report.csv missing required columns"))

out = csv.with_name("coverage_report.xlsx")
wb  = Workbook()
ws  = wb.active; ws.title = "RUR2_COVERAGE"

# Write data
ws.append(need)
for r in df.itertuples(index=False): ws.append(list(r))
end = ws.max_row

# Make an Excel Table (stable refs)
tbl = Table(displayName="RUR2_COVERAGE", ref=f"A1:E{end}")
tbl.tableStyleInfo = TableStyleInfo(name="TableStyleMedium2", showRowStripes=False, showColumnStripes=False)
ws.add_table(tbl)
ws.freeze_panes = "A2"

# Hidden validation sheet with Y/N list + named range
vs = wb.create_sheet("VALIDATIONS")
vs["A1"], vs["A2"] = "Y", "N"
vs.sheet_state = "hidden"
wb.defined_names.append(DefinedName(name="YN", attr_text="VALIDATIONS!$A$1:$A$2"))

# Data validation for Column B
dv = DataValidation(type="list", formula1="=YN", allow_blank=True, showDropDown=True)
ws.add_data_validation(dv)
dv.add(f"B2:B{end}")

wb.save(out)

# Quick verify of DV + names
wb2 = load_workbook(out, data_only=True)
ws2 = wb2["RUR2_COVERAGE"]
report = {
  "headers": [c.value for c in ws2[1]],
  "rows": ws2.max_row-1,
  "defined_names": [dn.name for dn in wb2.defined_names.definedName],
  "dv": [(d.type, d.formula1, str(d.sqref)) for d in ws2.data_validations.dataValidation],
}
print(json.dumps(report, indent=2))
PY

export FIX=./Fixes
export PDF="$FIX/pdf_temp_export.pdf"
export COV="$FIX/reports/coverage_report.csv"
export XLSX="$FIX/reports/coverage_report.xlsx"
export OUT="$FIX/reports/qa_run.txt"
bash QA_runner.sh