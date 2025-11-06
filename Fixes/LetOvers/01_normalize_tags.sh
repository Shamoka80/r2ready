#!/usr/bin/env bash
set -euo pipefail
echo "== normalize =="

IN=""
for f in ./Fixes/questions.csv ./Fixes/questions_fixed.csv ./Fixes/questions_tag_audit.csv; do
  [ -f "$f" ] && { IN="$f"; break; }
done
[ -z "$IN" ] && { echo "ERR: no input CSV in ./Fixes/"; exit 1; }

STAMP="$(date +%Y%m%d-%H%M%S)"
OUT="./Fixes/questions.csv"
AUDIT="./Fixes/reports/tag_normalization_audit.csv"

# backup any existing canonical file
if [ -f "$OUT" ]; then
  cp "$OUT" "./Fixes/backup/questions.$STAMP.csv"
fi

python3 - "$IN" "$OUT" "$AUDIT" << 'PY'
import csv, re, sys, time
IN, OUT, AUDIT = sys.argv[1], sys.argv[2], sys.argv[3]

CANON = [*(f"CR{i}" for i in range(1,11)), *list("ABCDEFG")]
CANON_SET = set(CANON)

CR_PATTERNS = [
  re.compile(r"\bCR[-\s]?(\d{1,2})\b", re.I),
  re.compile(r"\bCORE\s+REQUIREMENT\s+(\d{1,2})\b", re.I),
  re.compile(r"\bREQUIREMENT\s+(\d{1,2})\b", re.I),
]
APP_PATTERNS = [
  re.compile(r"\bAPPENDIX\s*([A-G])\b", re.I),
  re.compile(r"\bAPP\s*([A-G])\b", re.I),
  re.compile(r"\b([A-G])\b(?=.*\bAPPENDIX\b)", re.I),
]

def tokify(s):
  if not s: return []
  # split on common separators
  parts = re.split(r"[;,\|/\s]+", s.upper())
  return [p for p in parts if p]

def extract_tags(text):
  tags = set()
  if not text: return tags
  t = text.upper()
  for pat in CR_PATTERNS:
    for m in pat.findall(t):
      try:
        n = int(m)
        if 1 <= n <= 10: tags.add(f"CR{n}")
      except: pass
  for pat in APP_PATTERNS:
    for m in pat.findall(t):
      c = m.upper()
      if c in "ABCDEFG": tags.add(c)
  # direct tokens like CR1, B, etc.
  for p in tokify(t):
    if p in CANON_SET: tags.add(p)
  return tags

def parse_row(row):
  # inputs can have: id, text, tags, raw_tags, category, etc.
  rid = row.get("id") or row.get("ID") or row.get("question_id") or ""
  text = row.get("text") or row.get("question") or row.get("body") or ""
  tags_existing = row.get("tags","")
  raw_tags = row.get("raw_tags","") or row.get("tag_source","") or ""
  category = row.get("category","") or row.get("section","")

  found = set()
  # prefer existing canonical tags if already present
  for p in tokify(tags_existing):
    if p in CANON_SET: found.add(p)
  if not found:
    # derive from raw fields
    for src in (raw_tags, category, text):
      found |= extract_tags(src)
  # canonical order
  canonical = [c for c in CANON if c in found]
  return rid, text, canonical, tags_existing, raw_tags, category

with open(IN, newline='', encoding='utf-8') as f:
  rdr = csv.DictReader(f)
  rows = list(rdr)

if not rows:
  print("ERR: input CSV empty", file=sys.stderr); sys.exit(1)

# write canonical questions.csv (preserve original cols plus canonical 'tags')
fieldnames = list(rows[0].keys())
if "tags" not in fieldnames: fieldnames.append("tags")
with open(OUT, "w", newline='', encoding='utf-8') as wf, \
     open(AUDIT, "w", newline='', encoding='utf-8') as af:
  w = csv.DictWriter(wf, fieldnames=fieldnames)
  w.writeheader()
  aw = csv.writer(af)
  aw.writerow(["id","before_tags","raw_tags","category","after_tags","status","unknown_tokens"])

  for r in rows:
    rid, text, canonical, tags_existing, raw_tags, category = parse_row(r)
    after = ";".join(canonical)
    # unknowns (from existing tags only)
    unknown = [t for t in tokify(tags_existing) if t not in CANON_SET] if tags_existing else []
    status = "kept" if tags_existing and after else ("inferred" if after else "missing")
    r2 = dict(r)
    r2["tags"] = after
    w.writerow(r2)
    aw.writerow([rid, tags_existing, raw_tags, category, after, status, ";".join(unknown)])

print(f"OK: wrote {OUT} and {AUDIT}")
PY

echo "OK"
