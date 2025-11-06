#!/usr/bin/env bash
set -euo pipefail

# --- paths (defaults; override via env if needed) ---
export FIX="${FIX:-./Fixes}"
export EMAIL_PDF="${EMAIL_PDF:-$FIX/email_temp_export.pdf}"
export PDF="${PDF:-$FIX/pdf_temp_export.pdf}"
export COV="${COV:-$FIX/reports/coverage_report.csv}"
export XLSX="${XLSX:-$FIX/reports/coverage_report.xlsx}"
export OUTD="${OUTD:-$FIX/reports}"
export TPLJSON="${TPLJSON:-$FIX/templates/email_template.json}"

mkdir -p "$OUTD" "$(dirname "$TPLJSON")"

# --- venv (local, no user-site) ---
VENV=".venv"; PY="$VENV/bin/python"
if [ ! -x "$PY" ]; then
  python3 -m venv "$VENV"
fi
# shellcheck disable=SC1090
. "$VENV/bin/activate"
export PIP_USER=0 PIP_CONFIG_FILE=/dev/null
python -m pip -q install --upgrade pip setuptools wheel >/dev/null
python -m pip -q install --no-user pandas PyPDF2 python-docx openpyxl >/dev/null

# --- runner (pure Python) ---
"$PY" - <<'PY'
import os, re, json, hashlib, datetime as dt, pathlib as pl
from email.message import EmailMessage
from email.policy import default as default_policy
from PyPDF2 import PdfReader
import pandas as pd
from docx import Document

FIX      = pl.Path(os.environ["FIX"])
EMAILPDF = pl.Path(os.environ["EMAIL_PDF"])
PDF      = pl.Path(os.environ["PDF"])
COV      = pl.Path(os.environ["COV"])
XLSX     = pl.Path(os.environ["XLSX"])
OUTD     = pl.Path(os.environ["OUTD"])
TPLJSON  = pl.Path(os.environ["TPLJSON"])

OUTD.mkdir(parents=True, exist_ok=True)

def sha256(p: pl.Path) -> str:
    h=hashlib.sha256()
    with open(p,'rb') as f:
        for chunk in iter(lambda: f.read(1<<20), b''): h.update(chunk)
    return h.hexdigest()

def read_pdf_text(p: pl.Path) -> str:
    txt=[]
    r=PdfReader(str(p))
    for pg in r.pages:
        try:
            txt.append(pg.extract_text() or "")
        except Exception:
            txt.append("")
    return "\n".join(txt).strip()

def extract_placeholders(s: str):
    return sorted(set(re.findall(r"\{\{\s*([A-Z0-9_.]+)\s*\}\}", s)))

def ensure_template_json():
    """Create sidecar from PDF once; reuse thereafter."""
    if TPLJSON.exists(): 
        return json.loads(TPLJSON.read_text())
    base_text = read_pdf_text(EMAILPDF)
    lines = [ln.strip() for ln in base_text.splitlines() if ln.strip()]
    subject = ""
    # Heuristics: line starting with 'Subject:' else first non-empty line
    for ln in lines:
        m = re.match(r"Subject:\s*(.+)$", ln, flags=re.I)
        if m: subject = m.group(1).strip(); break
    if not subject and lines: subject = lines[0]
    # Body = everything (for fidelity, keep PDF text with newlines)
    body = base_text
    ph = sorted(extract_placeholders(subject) + extract_placeholders(body))
    tpl = {
        "source_pdf": str(EMAILPDF),
        "extracted_at": dt.datetime.utcnow().isoformat()+"Z",
        "base": {
            "subject": subject,
            "body": body,
            "placeholders": ph
        },
        # Default: reuse base for both; caller may override later
        "emails": {
            "client_update": {"prefix": "[Client] "},
            "internal_review": {"prefix": "[Internal] "}
        }
    }
    TPLJSON.write_text(json.dumps(tpl, indent=2))
    return tpl

def flatten(prefix, obj, out):
    if isinstance(obj, dict):
        for k,v in obj.items(): flatten(f"{prefix}{k}.", v, out)
    elif isinstance(obj, list):
        out[prefix.rstrip(".")] = ", ".join(map(str,obj))
    else:
        out[prefix.rstrip(".")] = obj

def context_from_artifacts():
    ctx = {}
    # timestamps
    now = dt.datetime.utcnow()
    ctx["DATE_UTC"] = now.date().isoformat()
    ctx["DATETIME_UTC"] = now.isoformat()+"Z"
    # Phase2 summary (optional)
    p2 = OUTD/"phase2_summary.json"
    if p2.exists():
        j=json.loads(p2.read_text())
        flatten("", j, ctx)
    # Coverage CSV (optional)
    if COV.exists():
        df=pd.read_csv(COV)
        if "Requirement" in df.columns and "Covered" in df.columns:
            ctx["COVERAGE_TOTAL"] = int(len(df))
            ctx["COVERAGE_Y"] = int((df["Covered"]=="Y").sum())
            ctx["COVERAGE_N"] = int((df["Covered"]=="N").sum())
            gaps = df.loc[df["Covered"]=="N","Requirement"].tolist()
            ctx["COVERAGE_GAPS"] = ", ".join(gaps) if gaps else ""
    # Hashes and sizes
    for label, path in (("PDF", PDF), ("XLSX", XLSX)):
        if path.exists():
            ctx[f"{label}_SHA256"]=sha256(path)
            ctx[f"{label}_BYTES"]=path.stat().st_size
            ctx[f"{label}_NAME"]=path.name
            ctx[f"{label}_PATH"]=str(path)
    return ctx

def resolve(text:str, mapping:dict):
    def rep(m):
        key=m.group(1).strip()
        return str(mapping.get(key,""))
    return re.sub(r"\{\{\s*([A-Z0-9_.]+)\s*\}\}", rep, text)

def eml_write(path: pl.Path, subject:str, body:str, to:str, attachments: list[pl.Path]):
    msg = EmailMessage(policy=default_policy)
    msg["Subject"]=subject
    msg["From"]="no-reply@rur2.local"
    msg["To"]=to
    # text and simple HTML (preserve newlines)
    msg.set_content(body)
    html = "<html><body><pre style='font-family:inherit;white-space:pre-wrap'>"+ \
           (body.replace("&","&amp;").replace("<","&lt;").replace(">","&gt;")) + \
           "</pre></body></html>"
    msg.add_alternative(html, subtype="html")
    for p in attachments:
        if not p.exists(): continue
        data = p.read_bytes()
        if p.suffix.lower()==".pdf":
            ctype=("application","pdf")
        elif p.suffix.lower()==".xlsx":
            ctype=("application","vnd.openxmlformats-officedocument.spreadsheetml.sheet")
        else:
            ctype=("application","octet-stream")
        msg.add_attachment(data, maintype=ctype[0], subtype=ctype[1], filename=p.name)
    path.write_bytes(bytes(msg))

def build_docx(path: pl.Path, ctx: dict):
    doc = Document()
    doc.add_heading("RUR2 Executive Summary", level=0)
    # Key bullets
    p = doc.add_paragraph()
    p.add_run("Date (UTC): ").bold=True; p.add_run(ctx.get("DATE_UTC",""))
    # Coverage section (optional)
    if "COVERAGE_TOTAL" in ctx:
        doc.add_heading("Coverage Snapshot", level=1)
        b = doc.add_paragraph(style=None)
        b.add_run(f"Total rows: {ctx['COVERAGE_TOTAL']}\n")
        b.add_run(f"Covered = Y: {ctx.get('COVERAGE_Y',0)} / N: {ctx.get('COVERAGE_N',0)}\n")
        gaps = ctx.get("COVERAGE_GAPS","")
        if gaps:
            doc.add_paragraph("Gaps:", style=None)
            for g in gaps.split(","):
                if g.strip(): doc.add_paragraph(g.strip(), style="List Bullet")
        else:
            doc.add_paragraph("No gaps detected.")
    # Artifacts (hashes)
    doc.add_heading("Artifacts", level=1)
    for lab in ("PDF","XLSX"):
        if f"{lab}_NAME" in ctx:
            par = doc.add_paragraph()
            par.add_run(f"{lab}: ").bold=True
            par.add_run(f"{ctx[lab+'_NAME']}  sha256:{ctx[lab+'_SHA256']}")
    doc.save(path)

# --- main ---
errors=[]
tpl = ensure_template_json()
ctx = context_from_artifacts()

base_subject = tpl["base"]["subject"]
base_body    = tpl["base"]["body"]

# Two drafts: client + internal (same body unless template later diverges)
pairs = [
  ("client_update",  OUTD/"client_update.eml",   "client@example.com"),
  ("internal_review",OUTD/"internal_review.eml","review@example.com"),
]

attachments = [p for p in (PDF, XLSX) if p.exists()]

for key, path, toaddr in pairs:
    prefix = tpl["emails"].get(key,{}).get("prefix","")
    subj = resolve(prefix + base_subject, ctx)
    body = resolve(base_body, ctx)
    eml_write(path, subj, body, toaddr, attachments)
    if "{{" in subj or "{{" in body:
        errors.append(f"Unresolved placeholders in {path.name}")

# DOCX
docx_path = OUTD/"exec_summary.docx"
build_docx(docx_path, ctx)
if not docx_path.exists():
    errors.append("exec_summary.docx not created")

# Final report
ok = not errors
print(json.dumps({
  "ok": ok,
  "errors": errors,
  "outputs": {
    "client_eml": str((OUTD/"client_update.eml")),
    "internal_eml": str((OUTD/"internal_review.eml")),
    "exec_summary_docx": str(docx_path),
    "template_sidecar": str(TPLJSON)
  }
}, indent=2))
if not ok: raise SystemExit(1)
PY
echo "DONE Phase 4"
