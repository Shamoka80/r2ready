#!/usr/bin/env bash
set -euo pipefail
echo "== coverage =="

IN="./Fixes/questions.csv"
[ -f "$IN" ] || { echo "ERR: $IN not found (run Part 2)"; exit 1; }

OUT_COV="./Fixes/reports/coverage_report.csv"
OUT_MAP="./Fixes/reports/binding_map_v1.json"

python3 - "$IN" "$OUT_COV" "$OUT_MAP" << 'PY'
import csv, json, sys
IN, OUT_COV, OUT_MAP = sys.argv[1], sys.argv[2], sys.argv[3]

REQS = [*(f"CR{i}" for i in range(1,11)), *list("ABCDEFG")]

def split_tags(s):
  if not s: return []
  return [t.strip() for t in s.replace(",", ";").split(";") if t.strip()]

rows=[]
with open(IN, newline='', encoding='utf-8') as f:
  rdr = csv.DictReader(f)
  for r in rdr:
    rows.append(r)

# index by requirement
by_req = {k: [] for k in REQS}
for r in rows:
  rtags = set(split_tags(r.get("tags","").upper()))
  for req in REQS:
    if req in rtags:
      by_req[req].append(r)

# write coverage
with open(OUT_COV, "w", newline='', encoding='utf-8') as wf:
  w = csv.writer(wf)
  w.writerow(["Requirement","Covered","Count","QuestionIDs","ProposedAddIfGap"])
  for req in REQS:
    items = by_req[req]
    covered = "Y" if items else "N"
    ids = ";".join([str(x.get("id","")) for x in items if x.get("id")])
    proposed = f"ADD_{req}_QUESTION" if not items else ""
    w.writerow([req, covered, len(items), ids, proposed])

# write binding map
emit = {}
for req in REQS:
  emit[req] = [
    {
      "id": r.get("id"),
      "text": (r.get("text") or r.get("question") or "")[:300],
      "tags": r.get("tags","")
    }
    for r in by_req[req]
  ]

with open(OUT_MAP, "w", encoding='utf-8') as jf:
  json.dump(emit, jf, ensure_ascii=False, indent=2)

# quick console summary
gaps = [k for k,v in by_req.items() if not v]
print("GAPS:", ", ".join(gaps) if gaps else "None")
print(f"OK: wrote {OUT_COV} and {OUT_MAP}")
PY

echo "OK"
