# QA_runner.sh
set -euo pipefail

# Inputs (override via env if needed)
COV=${COV:-./Fixes/reports/coverage_report.csv}
PDF=${PDF:-./Fixes/pdf_temp_export.pdf}                    # template OK
XLSX=${XLSX:-./Fixes/exports/sample_assessment.xlsx}       # optional
OUT=${OUT:-./Fixes/reports/export_qc.json}

echo "==> Checking files"
test -f "$COV" || { echo "Missing coverage CSV: $COV"; exit 1; }

echo "==> Installing deps"
python3 -m pip -q install --upgrade pip >/dev/null
python3 -m pip -q install pandas PyPDF2 openpyxl >/dev/null

echo "==> Running QA"
python3 - <<'PY'
import os, json, hashlib
from pathlib import Path
import pandas as pd

from PyPDF2 import PdfReader
from openpyxl import load_workbook

COV = Path(os.environ["COV"])
PDF = Path(os.environ["PDF"])
XLSX = Path(os.environ["XLSX"])
OUT = Path(os.environ["OUT"])

REQS = [f"CR{i}" for i in range(1,11)] + list("ABCDEFG")
SCHEMA = ["Requirement","Covered","Count","QuestionIDs","ProposedAddIfGap"]

def sha256(p: Path):
    h=hashlib.sha256()
    with p.open("rb") as f:
        for chunk in iter(lambda:f.read(1<<16), b""): h.update(chunk)
    return h.hexdigest()

def cov_checks():
    issues=[]
    df=pd.read_csv(COV, dtype=str).fillna("")
    if list(df.columns)!=SCHEMA:
        issues.append({"type":"schema_mismatch","got":list(df.columns),"want":SCHEMA})
    present=set(df["Requirement"])
    missing=[r for r in REQS if r not in present]
    if missing: issues.append({"type":"req_missing","items":missing})
    for _,r in df.iterrows():
        req=r["Requirement"]; covered=(r["Covered"] or "").upper(); cnt=int(r["Count"] or "0")
        qids=(r["QuestionIDs"] or "").strip(); prop=(r["ProposedAddIfGap"] or "").strip()
        if covered=="Y" and (cnt<=0 or not qids):
            issues.append({"type":"covered_without_evidence","req":req,"count":cnt,"qids":qids})
        if covered!="Y" and not prop:
            issues.append({"type":"gap_missing_proposal","req":req})
    return df, issues

def pdf_checks():
    if not PDF.exists(): return {"skipped":True}
    rd=PdfReader(str(PDF))
    return {"skipped":False,"pages":len(rd.pages),"sha256":sha256(PDF)}

def xlsx_checks():
    if not XLSX.exists(): return {"skipped":True}
    wb=load_workbook(str(XLSX), data_only=True)
    sheets=wb.sheetnames
    has_cov="Coverage" in sheets
    dv_ok=False
    if has_cov:
        ws=wb["Coverage"]
        dv=getattr(ws,"data_validations",None)
        if dv:
            for dv_obj in dv.dataValidation:
                if dv_obj.type=="list" and "B" in str(dv_obj.sqref or ""): dv_ok=True; break
    return {"skipped":False,"sheets":sheets,"has_coverage":has_cov,"cov_colB_listDV":dv_ok,"sha256":sha256(XLSX)}

df, cov_issues = cov_checks()
pdf_info = pdf_checks()
xlsx_info = xlsx_checks()

ok_cov = len(cov_issues)==0
ok_pdf = pdf_info.get("skipped") or pdf_info.get("pages",0)>0
ok_xlsx = xlsx_info.get("skipped") or (xlsx_info.get("has_coverage") and xlsx_info.get("cov_colB_listDV"))

result = {
  "inputs": {
    "coverage_csv": {"path": str(COV), "rows": len(df)},
    "pdf": {"path": str(PDF), **({"exists": PDF.exists()}), **({"sha256": sha256(PDF)} if PDF.exists() else {})},
    "xlsx": {"path": str(XLSX), **({"exists": XLSX.exists()}), **({"sha256": sha256(XLSX)} if XLSX.exists() else {})},
  },
  "checks": {"coverage_issues": cov_issues, "pdf": pdf_info, "xlsx": xlsx_info},
  "ok": bool(ok_cov and ok_pdf and ok_xlsx)
}

OUT.parent.mkdir(parents=True, exist_ok=True)
OUT.write_text(json.dumps(result, indent=2))
print("QC:", "PASS" if result["ok"] else "FAIL")
print(json.dumps(result["checks"], indent=2))
exit(0 if result["ok"] else 1)
PY

echo "==> Wrote $OUT"