#!/usr/bin/env python3
import csv, json, os, re, sys
from typing import Dict, List, Set

QUESTIONS="./Fixes/questions.csv"
PDF="./Fixes/pdf_temp_export.pdf"
OUTDIR="./Fixes/reports"
COVERAGE_OUT=f"{OUTDIR}/coverage_report.csv"
BINDING_OUT=f"{OUTDIR}/binding_map_v1.json"

REQS=[*(f"CR{i}" for i in range(1,11)),"A","B","C","D","E","F","G"]

def ensure():
    if not os.path.exists(QUESTIONS): sys.exit(f"Missing {QUESTIONS}")
    if not os.path.exists(PDF): sys.exit(f"Missing {PDF}")
    os.makedirs(OUTDIR, exist_ok=True)

def load_rows(path)->List[Dict]:
    with open(path,"r",encoding="utf-8-sig",newline="") as f:
        return list(csv.DictReader(f))

ID_CANDS=("id","question_id","qid","key","ref")
TXT_CANDS=("text","question","prompt","body","label")
TAG_CANDS=("tags","tag","controls","control","categories","category","cr","mapping")

def pick(cols, cands):
    lowered={c.lower():c for c in cols}
    hits=[lowered[c] for c in cands if c in lowered]
    return hits

CR_RX=re.compile(r"\bCR[-_ ]?0?([1-9]|10)\b", re.I)

def norm_cr(tok:str):
    t=re.sub(r"[\s_-]+","",tok or "").upper()
    if t.startswith("CR"):
        n=t[2:]
        if n.isdigit() and 1<=int(n)<=10: return f"CR{int(n)}"
    return None

def tokens_from(val:str)->Set[str]:
    if not val: return set()
    toks=re.split(r"[,\|;/\s]+", str(val))
    return {t.strip().upper() for t in toks if t.strip()}

def coverage_from_rows(rows:List[Dict])->Dict[str,List[str]]:
    cov={req:[] for req in REQS}
    if not rows: return cov
    cols=rows[0].keys()
    id_field=next((c for c in cols if c.lower() in ID_CANDS), None)
    txt_field=next((c for c in cols if c.lower() in TXT_CANDS), None)
    tag_fields=[c for c in cols if c.lower() in TAG_CANDS]

    for idx,row in enumerate(rows, start=1):
        qid=row.get(id_field) or f"row{idx}"
        tags=set()
        for tf in tag_fields:
            tags |= tokens_from(row.get(tf,""))
        # tag-driven CRs
        for t in list(tags):
            cr=norm_cr(t)
            if cr and qid not in cov[cr]:
                cov[cr].append(qid)
        # tag-driven A–G (ONLY from tags to avoid false positives)
        for letter in list("ABCDEFG"):
            if letter in tags and qid not in cov[letter]:
                cov[letter].append(qid)
        # text-driven CRs (fallback)
        if txt_field:
            txt=str(row.get(txt_field,""))
            for m in CR_RX.finditer(txt):
                cr=f"CR{int(m.group(1))}"
                if qid not in cov[cr]:
                    cov[cr].append(qid)
    return cov

def write_coverage(cov:Dict[str,List[str]]):
    rows=[]
    for req in REQS:
        ids=cov.get(req,[])
        rows.append({
            "Requirement": req,
            "Covered": "Y" if ids else "N",
            "Count": len(ids),
            "QuestionIDs": ";".join(ids),
            "ProposedAddIfGap": ("" if ids else f"ADD_{req}_QUESTION")
        })
    with open(COVERAGE_OUT,"w",encoding="utf-8",newline="") as f:
        w=csv.DictWriter(f,fieldnames=list(rows[0].keys()))
        w.writeheader(); w.writerows(rows)

def extract_pdf_fields(pdf_path:str)->Dict[str,dict]:
    try:
        from PyPDF2 import PdfReader
    except Exception as e:
        sys.exit(f"PyPDF2 not available: {e}")
    r=PdfReader(pdf_path)
    fields={}
    # Try robust page-scan (works even when get_fields() is empty)
    for pi,page in enumerate(r.pages):
        annots=page.get("/Annots") or []
        try:
            annots=list(annots)
        except Exception:
            continue
        for a in annots:
            try:
                obj=a.get_object()
                name=obj.get("/T")
                ftype=obj.get("/FT")
                if name:
                    fields[str(name)]={"bind_to":"", "page":pi, "type": str(ftype) if ftype else "Unknown"}
            except Exception:
                continue
    # Fallback to get_fields if nothing found
    if not fields:
        try:
            raw=(r.get_fields() or {})
            for k,v in raw.items():
                fields[str(k)]={"bind_to":"", "page":None, "type":str(v.get('/FT',"Unknown"))}
        except Exception:
            pass
    return fields

def write_binding_map(fields:Dict[str,dict]):
    data={"template_pdf": PDF, "version": 1, "fields": fields}
    with open(BINDING_OUT,"w",encoding="utf-8") as f:
        json.dump(data,f,indent=2)

def main():
    ensure()
    qs=load_rows(QUESTIONS)
    cov=coverage_from_rows(qs)
    write_coverage(cov)
    fields=extract_pdf_fields(PDF)
    write_binding_map(fields)
    print(f"OK: wrote {COVERAGE_OUT} and {BINDING_OUT}")
    # Exit nonzero if critical gaps exist (helps CI)
    gaps=[k for k,v in cov.items() if not v]
    if gaps:
        print("GAPS:", ", ".join(gaps))
        # still exit 0 to allow inspection; flip to 1 if you want hard fail.
    return 0

if __name__=="__main__":
    sys.exit(main())
