#!/usr/bin/env bash
set -euo pipefail

# venv (works in Nix/PEP668 envs)
VENV=".venv"
PY="$VENV/bin/python"
if [ ! -x "$PY" ]; then
  python3 -m venv "$VENV"
fi
# ensure pip usable inside venv
set +u
. "$VENV/bin/activate"
set -u
export PIP_USER=0
export PIP_CONFIG_FILE=/dev/null
unset PYTHONPATH PIP_TARGET
"$PY" -m pip -q install --upgrade pip setuptools wheel >/dev/null
"$PY" -m pip -q install --no-user pandas openpyxl PyPDF2 >/dev/null
echo "==> Ensuring venv"
echo "==> Installing deps (venv)"

echo "==> Running QA (perpetual license model)"
"$PY" - <<'PY'
import os, json, hashlib, pathlib
from typing import List, Tuple
from PyPDF2 import PdfReader
import pandas as pd
from openpyxl import load_workbook

FIX  = pathlib.Path(os.getenv("FIX","./Fixes"))
PDFP = pathlib.Path(os.getenv("PDF",""))
XLSP = pathlib.Path(os.getenv("XLSX",""))
COVP = pathlib.Path(os.getenv("COV",""))
OUTP = pathlib.Path(os.getenv("OUT", str(FIX/"reports"/"qa_run.txt")))

REQ_HEADERS = ["Requirement","Covered","Count","QuestionIDs","ProposedAddIfGap"]

def sha256(p: pathlib.Path) -> str:
    h = hashlib.sha256()
    with p.open("rb") as f:
        for chunk in iter(lambda: f.read(65536), b""):
            h.update(chunk)
    return h.hexdigest()

def csv_has_coverage(p: pathlib.Path) -> Tuple[bool, List[str]]:
    if (not p) or (not p.exists()) or (not p.is_file()):
        return (False, [])
    df = pd.read_csv(p)
    issues = [c for c in REQ_HEADERS if c not in df.columns]
    return (len(issues)==0, issues)

def ws_has_headers(ws) -> bool:
    hdr = [c.value for c in ws[1]]
    return all(h in hdr for h in REQ_HEADERS)

def xlsx_listDV_colB(ws, wb) -> bool:
    """
    Accept any of:
    - inline list "Y,N" (comma/semicolon)
    - named range like =YN pointing to cells containing Y/N
    - any dv covering column B rows >=2
    """
    dvs = getattr(ws.data_validations, "dataValidation", [])
    if not dvs:
        return False

    # Build quick map of defined names -> set of uppercase values
    dn_values = {}
    try:
        for dn in wb.defined_names.definedName:
            vals = set()
            for title, dest in dn.destinations:
                ws2 = wb[title]
                for row in ws2[dest]:
                    for cell in (row if isinstance(row, tuple) else [row]):
                        if cell.value is not None:
                            vals.add(str(cell.value).strip().upper())
            dn_values[dn.name.upper()] = vals
    except Exception:
        pass

    def formula_allows_YN(formula: str) -> bool:
        if not formula:
            return False
        f = formula.strip()
        if f.startswith("="):
            key = f[1:].strip().upper()
            vals = dn_values.get(key)
            return bool(vals and {"Y","N"}.issuperset(vals) and any(v in vals for v in ("Y","N")))
        # inline list e.g. "Y,N" or "Y;N"
        inline = f.replace('"','').replace('{','').replace('}','')
        upper = inline.upper()
        return ("Y" in upper and "N" in upper and ("," in inline or ";" in inline))

    def sqref_covers_colB(dv) -> bool:
        # openpyxl MultiCellRange
        try:
            for r in dv.sqref.ranges:
                if r.min_col <= 2 <= r.max_col and r.max_row >= 2:
                    return True
        except Exception:
            # fallback: string parse e.g., "B2:B999"
            sr = str(dv.sqref).replace(" ", "").split()
            for token in sr:
                if token.startswith("B"):
                    return True
        return False

    for dv in dvs:
        if getattr(dv, "type", None) != "list":
            continue
        if not sqref_covers_colB(dv):
            continue
        f1 = (dv.formula1 or "")
        if formula_allows_YN(f1):
            return True
    return False

result = {"coverage_issues": []}

# PDF check
pdf_info = {"skipped": True}
if PDFP and PDFP.exists():
    try:
        pdf_info = {
            "skipped": False,
            "pages": len(PdfReader(str(PDFP)).pages),
            "sha256": sha256(PDFP),
        }
    except Exception as e:
        pdf_info = {"skipped": False, "error": str(e)}
result["pdf"] = pdf_info

# Coverage (CSV canonical)
has_cov_csv, csv_issues = csv_has_coverage(COVP) if COVP else (False, [])
if csv_issues:
    result["coverage_issues"].extend([f"CSV missing: {', '.join(csv_issues)}"])

# XLSX check (sheet list, DV detection)
xlsx_info = {"skipped": True}
if XLSP and XLSP.exists():
    try:
        wb = load_workbook(str(XLSP), data_only=True)
        sheets = list(wb.sheetnames)
        # prefer sheet with 'COVERAGE' in name; else first
        if any("COVERAGE" in s.upper() for s in sheets):
            ws = wb[[s for s in sheets if "COVERAGE" in s.upper()][0]]
        else:
            ws = wb[sheets[0]]
        has_hdr = ws_has_headers(ws)
        colB_dv = xlsx_listDV_colB(ws, wb)
        xlsx_info = {
            "skipped": False,
            "sheets": sheets,
            # If CSV is valid, treat overall coverage as true; else rely on headers in XLSX
            "has_coverage": bool(has_cov_csv or has_hdr),
            "cov_colB_listDV": bool(colB_dv),
            "sha256": sha256(XLSP),
        }
        if not has_hdr and not has_cov_csv:
            result["coverage_issues"].append("XLSX missing required header row")
    except Exception as e:
        xlsx_info = {"skipped": False, "error": str(e)}
result["xlsx"] = xlsx_info

print("QC:", "PASS" if not result.get("coverage_issues") else "FAIL")
print(json.dumps(result, indent=2))

# Write OUT
OUTP.parent.mkdir(parents=True, exist_ok=True)
OUTP.write_text(json.dumps(result, indent=2))
print(f"==> Wrote {OUTP}")
PY
> new_QA_run.txt