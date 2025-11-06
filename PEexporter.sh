# 04_exporter.py
from pathlib import Path
from datetime import datetime
import sys, json
import pandas as pd
from PyPDF2 import PdfReader, PdfWriter
from reportlab.pdfgen import canvas
from reportlab.lib.pagesizes import letter

ROOT = Path(".")
FIXES = ROOT / "Fixes"
COVER = FIXES / "reports" / "coverage_report.csv"
BINDING = FIXES / "reports" / "binding_map_v1.json"
TPL = FIXES / "pdf_temp_export.pdf"
OUT_DIR = FIXES / "exports"
PDF_OUT = OUT_DIR / "sample_assessment.pdf"
XLSX_OUT = OUT_DIR / "sample_assessment.xlsx"

def load_binding():
    if not BINDING.exists():
        return []
    try:
        data = json.loads(BINDING.read_text())
        rows = []
        for req, qids in data.items():
            for q in (qids or []):
                rows.append({"Requirement": req, "QuestionID": q})
        return rows
    except Exception:
        return []

def make_overlay(w, h, coverage_df, tmp_overlay_path):
    c = canvas.Canvas(str(tmp_overlay_path), pagesize=(w, h))
    ts = datetime.utcnow().strftime("%Y-%m-%d %H:%M UTC")
    c.setFont("Helvetica-Bold", 16); c.drawString(36, h-54, "RUR2 — Assessment Export (Sample)")
    c.setFont("Helvetica", 10)
    c.drawString(36, h-72, f"Generated: {ts}")
    c.drawString(36, h-86, f"Source: ./Fixes/reports/coverage_report.csv")

    # Summary
    total = len(coverage_df)
    covered = (coverage_df["Covered"].astype(str).str.upper() == "Y").sum()
    gaps = total - covered
    y = h-120
    c.setFont("Helvetica-Bold", 12); c.drawString(36, y, "Coverage Summary")
    c.setFont("Helvetica", 10)
    c.drawString(36, y-14, f"Requirements: {total}   Covered: {covered}   Gaps: {gaps}")

    # Table (first 12 rows)
    y -= 40
    c.setFont("Helvetica-Bold", 10)
    c.drawString(36, y, "Requirement"); c.drawString(150, y, "Covered"); c.drawString(220, y, "Count"); c.drawString(280, y, "ProposedAddIfGap")
    c.setFont("Helvetica", 10)
    y -= 12
    for _, r in coverage_df.head(12).iterrows():
        c.drawString(36, y, str(r.get("Requirement","")))
        c.drawString(150, y, str(r.get("Covered","")))
        c.drawString(220, y, str(r.get("Count","")))
        c.drawString(280, y, str(r.get("ProposedAddIfGap","")))
        y -= 12

    c.showPage(); c.save()

def export_pdf(coverage_df):
    reader = PdfReader(str(TPL))
    first = reader.pages[0]
    w = float(first.mediabox.width); h = float(first.mediabox.height)
    overlay = OUT_DIR / "_overlay.pdf"
    make_overlay(w, h, coverage_df, overlay)

    over_reader = PdfReader(str(overlay))
    writer = PdfWriter()

    # Overlay onto page 1
    base0 = reader.pages[0]
    base0.merge_page(over_reader.pages[0])  # stamp summary onto template
    writer.add_page(base0)

    # Append the rest of the template pages (if any)
    for i in range(1, len(reader.pages)):
        writer.add_page(reader.pages[i])

    with PDF_OUT.open("wb") as f:
        writer.write(f)
    overlay.unlink(missing_ok=True)

def export_xlsx(coverage_df, binding_rows):
    with pd.ExcelWriter(XLSX_OUT, engine="xlsxwriter") as xw:
        coverage_df.to_excel(xw, sheet_name="Coverage", index=False)
        if binding_rows:
            pd.DataFrame(binding_rows).to_excel(xw, sheet_name="BindingMap", index=False)
        wb = xw.book
        # Simple validation on Coverage.Covered
        ws = xw.sheets["Coverage"]
        last = len(coverage_df) + 1
        ws.data_validation(f"B2:B{last}", {"validate":"list","source":"Y,N"})
        # Conditional format gaps
        ws.conditional_format(f"B2:B{last}", {"type":"cell","criteria":"==","value":'"N"', "format": wb.add_format({"bg_color":"#FFF2CC"})})

def main():
    if not COVER.exists() or not TPL.exists():
        print("ERR: required files missing", file=sys.stderr); sys.exit(2)
    cov = pd.read_csv(COVER)
    export_pdf(cov)
    binding_rows = load_binding()
    export_xlsx(cov, binding_rows)
    # Quick QA
    ok = PDF_OUT.exists() and PDF_OUT.stat().st_size > 1024
    ok &= XLSX_OUT.exists() and XLSX_OUT.stat().st_size > 1024
    print("PDF:", PDF_OUT, PDF_OUT.stat().st_size if PDF_OUT.exists() else 0)
    print("XLSX:", XLSX_OUT, XLSX_OUT.stat().st_size if XLSX_OUT.exists() else 0)
    sys.exit(0 if ok else 1)

if __name__ == "__main__":
    main()