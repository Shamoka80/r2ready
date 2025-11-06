cat > phase0_part3_reports.sh <<'BASH'
set -euo pipefail
FIXES="${PWD}/Fixes"
NORM="${FIXES}/questions.normalized.csv"
PDF="${FIXES}/pdf_temp_export.pdf"
OUT="${FIXES}/reports"
COV="${OUT}/coverage_report.csv"
BIND="${OUT}/binding_map_v1.json"
mkdir -p "$OUT"

python3 - <<'PY'
import csv, json, os, sys
root = os.getcwd()
fixes = os.path.join(root, "Fixes")
norm = os.path.join(fixes, "questions.normalized.csv")
pdf = os.path.join(fixes, "pdf_temp_export.pdf")
out_cov = os.path.join(fixes, "reports", "coverage_report.csv")
out_bind = os.path.join(fixes, "reports", "binding_map_v1.json")

REQS = [*(f"CR{i}" for i in range(1,11)), *list("ABCDEFG")]

# load normalized
rows=[]
with open(norm, "r", encoding="utf-8") as f:
    rdr = csv.DictReader(f)
    rows = list(rdr)
qid_key = "id" if rows and "id" in rows[0] else ("question_id" if rows and "question_id" in rows[0] else "row_index")

# coverage
cov = {r: {"count":0, "ids":[]} for r in REQS}
for r in rows:
    qid = (r.get(qid_key) or "").strip()
    for t in (r.get("_normalized_tags") or "").split(";"):
        if t in cov:
            cov[t]["count"] += 1
            if qid: cov[t]["ids"].append(qid)

# write coverage CSV
with open(out_cov, "w", newline="", encoding="utf-8") as w:
    wr = csv.writer(w)
    wr.writerow(["Requirement","Covered","Count","QuestionIDs","ProposedAddIfGap"])
    for k in REQS:
        cnt = cov[k]["count"]
        ids = ",".join(cov[k]["ids"])
        wr.writerow([k, "Y" if cnt>0 else "N", cnt, ids, (f"ADD_{k}_QUESTION" if cnt==0 else "")])

# binding map v1 (skeleton anchors; safe defaults)
bindings = {}
for k in REQS:
    bindings[k] = {
        "pdf_anchor": f"{{{{{k}_SECTION}}}}",   # placeholder anchor in your template
        "questions": cov[k]["ids"],
        "status": "TBD"
    }

doc = {
    "version": 1,
    "template_path": pdf,
    "requirements": REQS,
    "bindings": bindings
}
with open(out_bind, "w", encoding="utf-8") as w:
    json.dump(doc, w, indent=2)

gaps = [k for k,v in cov.items() if v["count"]==0]
print(f"OK: coverage -> {out_cov}")
print(f"OK: binding map -> {out_bind}")
print("GAPS:", ", ".join(gaps) if gaps else "NONE")
PY
BASH
bash phase0_part3_reports.sh