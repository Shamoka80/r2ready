#!/usr/bin/env python3
import csv, json, sys, os, hashlib
from pathlib import Path

FIX = Path(os.environ.get("FIX","./Fixes"))
QCSV = Path(os.environ.get("QCSV", str(FIX/"questions.csv")))
OUTD = Path(os.environ.get("OUT", str(FIX/"reports")))
OUTD.mkdir(parents=True, exist_ok=True)

REQS = [*(f"CR{i}" for i in range(1,11)), *list("ABCDEFG")]

def norm_tags(val:str)->set[str]:
    if not val: return set()
    raw = [t.strip().upper().replace(" ", "") for t in val.replace(";",",").split(",")]
    return set(filter(None, raw))

def main():
    if not QCSV.exists():
        print(f"ERR: questions file not found: {QCSV}", file=sys.stderr); sys.exit(2)

    coverage = {r: {"count":0,"ids":[]} for r in REQS}
    missing_ev = []
    total=0

    with QCSV.open() as f:
        rd = csv.DictReader(f)
        cols = set(c.lower() for c in rd.fieldnames or [])
        # flexible field discovery
        idcol = "id" if "id" in cols else ( "question_id" if "question_id" in cols else None )
        tagcol = "tags" if "tags" in cols else ( "tag" if "tag" in cols else None )
        evcol  = "evidence" if "evidence" in cols else ( "evidence_path" if "evidence_path" in cols else None )
        if not idcol or not tagcol:
            print("ERR: CSV must contain at least ID and TAGS columns (id/tags).", file=sys.stderr); sys.exit(3)

        for row in rd:
            total += 1
            qid = row.get(idcol,"").strip()
            tags = norm_tags(row.get(tagcol,""))
            # coverage: any tag matching REQS
            matched = sorted(r for r in REQS if r in tags)
            for r in matched:
                coverage[r]["count"] += 1
                coverage[r]["ids"].append(qid)
            # evidence gating: if tagged EVIDENCE_REQUIRED but no evidence path/content
            if "EVIDENCE_REQUIRED" in tags:
                ev = (row.get(evcol,"") if evcol else "").strip()
                if not ev:
                    missing_ev.append({"id": qid, "tags": ",".join(sorted(tags))})

    cov_rows = [
      {"Requirement": r,
       "Covered": "Y" if coverage[r]["count"]>0 else "N",
       "Count": coverage[r]["count"],
       "QuestionIDs": ";".join(coverage[r]["ids"])}
      for r in REQS
    ]

    # write reports
    cov_csv = OUTD/"phase2_coverage.csv"
    with cov_csv.open("w", newline="") as f:
        w = csv.DictWriter(f, fieldnames=list(cov_rows[0].keys()))
        w.writeheader(); w.writerows(cov_rows)

    gaps_csv = OUTD/"phase2_missing_evidence.csv"
    with gaps_csv.open("w", newline="") as f:
        w = csv.DictWriter(f, fieldnames=["id","tags"])
        w.writeheader(); w.writerows(missing_ev)

    summary = {
      "total_questions": total,
      "requirements": { r: coverage[r]["count"] for r in REQS },
      "missing_evidence_count": len(missing_ev),
      "artifacts": {
        "coverage_csv": str(cov_csv),
        "missing_evidence_csv": str(gaps_csv)
      }
    }
    summ_json = OUTD/"phase2_summary.json"
    summ_json.write_text(json.dumps(summary, indent=2))

    print("OK Phase2")
    print(json.dumps(summary, indent=2))

if __name__ == "__main__":
    main()
