# Rebuild coverage_report.xlsx correctly (sheet "Coverage" + Y/N dropdown in Col B)
. .venv/bin/activate 2>/dev/null || true
python - <<'PY'
import pandas as pd, pathlib
from openpyxl import Workbook
from openpyxl.worksheet.datavalidation import DataValidation

csv = pathlib.Path("Fixes/reports/phase2_coverage.csv")
df = pd.read_csv(csv)

# normalize columns
rename = {c:'Requirement' for c in df.columns if c.lower()=='requirement'}
rename.update({c:'Count' for c in df.columns if c.lower()=='count'})
df = df.rename(columns=rename)

# add Covered (Y/N) and order columns
df['Covered'] = df['Count'].apply(lambda x: 'Y' if x>0 else 'N')
cols = ['Requirement','Covered'] + [c for c in df.columns if c not in ('Requirement','Covered')]
df = df[cols]

out = csv.parent / "coverage_report.xlsx"
wb = Workbook(); ws = wb.active; ws.title = "Coverage"
ws.append(list(df.columns))
for _, r in df.iterrows(): ws.append(list(r))

# data validation dropdown on Covered (col B)
dv = DataValidation(type="list", formula1='"Y,N"', allow_blank=False, showDropDown=True)
ws.add_data_validation(dv)
dv.add(f'B2:B{ws.max_row}')

wb.save(out)
print(f"WROTE {out}")
PY

# QA
export FIX=./Fixes
export PDF="$FIX/pdf_temp_export.pdf"
export XLSX="$FIX/reports/coverage_report.xlsx"
export OUT="$FIX/reports/qa_run.txt"
bash QA_runner.sh > ReRunner.txt