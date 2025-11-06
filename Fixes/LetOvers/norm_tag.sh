cat > phase0_part2_normalize.sh <<'BASH'
set -euo pipefail
FIXES="${PWD}/Fixes"
IN="${FIXES}/questions.csv"
OUT_DIR="${FIXES}/reports"
NORM="${FIXES}/questions.normalized.csv"
AUDIT="${OUT_DIR}/questions_tag_audit.csv"

python3 - <<'PY'
import csv, re, sys, os, json
root = os.getcwd()
fixes = os.path.join(root, "Fixes")
src = os.path.join(fixes, "questions.csv")
out_norm = os.path.join(fixes, "questions.normalized.csv")
out_audit = os.path.join(fixes, "reports", "questions_tag_audit.csv")
os.makedirs(os.path.dirname(out_audit), exist_ok=True)

REQS = [*(f"CR{i}" for i in range(1,11)), *list("ABCDEFG")]
REQ_SET = set(REQS)

def canon(tag: str):
    t = re.sub(r"[\s_]", "", tag or "", flags=re.I).upper()
    t = t.replace("-", "")  # collapse hyphens
    # CR variants
    m = re.match(r"^CR0?(\d{1,2})$", t)
    if m:
        num = int(m.group(1))
        if 1 <= num <= 10: return f"CR{num}"
    # letter buckets
    if t in list("ABCDEFG"): return t
    # splits like CR1A -> CR1 + A
    m2 = re.match(r"^(CR0?(\d{1,2}))([A-G])$", t)
    if m2:
        cr = m2.group(1)
        cr = re.sub(r"^CR0?","CR",cr)
        return [cr, m2.group(3)]
    # common synonyms
    syn = {
        "CONTROL1":"CR1","CONTROL2":"CR2","CONTROL3":"CR3","CONTROL4":"CR4","CONTROL5":"CR5",
        "CONTROL6":"CR6","CONTROL7":"CR7","CONTROL8":"CR8","CONTROL9":"CR9","CONTROL10":"CR10"
    }
    if t in syn: return syn[t]
    return t

def split_tags(raw):
    if not raw: return []
    parts = re.split(r"[;,|]", str(raw))
    out = []
    for p in parts:
        p = p.strip()
        if not p: continue
        c = canon(p)
        if isinstance(c, list):
            out.extend(c)
        else:
            out.append(c)
    # de-dup preserving order
    seen=set(); res=[]
    for x in out:
        if x not in seen:
            seen.add(x); res.append(x)
    return res

with open(src, "r", encoding="utf-8", errors="ignore") as f:
    sniffer = csv.Sniffer()
    sample = f.read(4096)
    f.seek(0)
    dialect = sniffer.sniff(sample) if sample else csv.excel
    rdr = csv.DictReader(f, dialect=dialect)
    rows = list(rdr)
    headers = rdr.fieldnames or []

tag_cols = [h for h in headers if h and h.lower() in ("tags","tag","labels","label","category","categories")]
id_col = next((h for h in headers if h and h.lower() in ("id","question_id","qid","uid")), None)
qid_fallback = False
if not id_col:
    id_col = "row_index"
    qid_fallback = True

unknown = {}
norm_rows = []
for idx, row in enumerate(rows, start=1):
    raw = ""
    for c in tag_cols:
        raw = row.get(c) or raw
    tags = split_tags(raw)
    keep = []
    for t in tags:
        if t in REQ_SET:
            keep.append(t)
        else:
            unknown[t] = unknown.get(t,0)+1
    row["_normalized_tags"] = ";".join(keep)
    if qid_fallback:
        row["row_index"] = str(idx)
    norm_rows.append(row)

# write normalized
norm_headers = headers.copy()
if "_normalized_tags" not in norm_headers: norm_headers.append("_normalized_tags")
if qid_fallback and "row_index" not in norm_headers: norm_headers = ["row_index"] + norm_headers
with open(out_norm, "w", newline="", encoding="utf-8") as w:
    wr = csv.DictWriter(w, fieldnames=norm_headers)
    wr.writeheader()
    wr.writerows(norm_rows)

# write audit
with open(out_audit, "w", newline="", encoding="utf-8") as w:
    wr = csv.writer(w)
    wr.writerow(["UnknownTag","Count"])
    for k,v in sorted(unknown.items(), key=lambda kv:(-kv[1], kv[0])):
        wr.writerow([k,v])

# stdout summary
cov = {r:0 for r in REQS}
for r in norm_rows:
    for t in (r.get("_normalized_tags") or "").split(";"):
        if t in cov: cov[t]+=1

gaps = [k for k,v in cov.items() if v==0]
print(f"OK: normalized -> {out_norm}")
print(f"OK: audit -> {out_audit}")
print("COVERAGE:", " ".join(f"{k}:{v}" for k,v in cov.items()))
print("GAPS:", ", ".join(gaps) if gaps else "NONE")
PY
BASH
bash phase0_part2_normalize.sh
