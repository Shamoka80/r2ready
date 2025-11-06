#!/usr/bin/env bash
set -euo pipefail
mkdir -p Fixes/qa

cat > Fixes/qa/phase7_e2e.sh <<'PYSH'
#!/usr/bin/env bash
set -euo pipefail
python - <<'PY'
import json, pathlib, sys
r = pathlib.Path("Fixes/reports")
out = {"ok": True, "checks": [], "errors": []}
def chk(ok,msg): out["checks"].append({"ok":bool(ok),"msg":msg}); out["ok"] &= bool(ok)
# Phase2 summary
p2 = r/"phase2_summary.json"
j2 = json.loads(p2.read_text()) if p2.exists() else {}
chk("total_questions" in j2 and j2["total_questions"]>=400, "phase2 total_questions >=400")
# Coverage CSV + XLSX QA
cov = r/"coverage_report.csv"; chk(cov.exists(), "coverage_report.csv exists")
qa  = r/"qa_run.txt"; jqa = json.loads(qa.read_text()) if qa.exists() else {}
chk(jqa.get("xlsx",{}).get("has_coverage")==True, "xlsx has coverage")
chk(jqa.get("xlsx",{}).get("cov_colB_listDV")==True, "xlsx DV Y/N present")
# Phase4 artifacts (from provided templates → outputs)
for f in ["rur2_auditor_draft.eml","rur2_internal_draft.eml","exec_summary.docx"]:
    chk((r/f).exists(), f"phase4 {f} exists")
# Phase5 credits
led = r/"credits_ledger.json"
if led.exists():
    L = json.loads(led.read_text())
    chk(isinstance(L.get("balance"), (int,float)), "credits balance is numeric")
else:
    chk(False, "credits_ledger.json missing")
# Phase6 security
sec = r/"security_e2e.json"; chk(sec.exists(), "security_e2e.json exists")
print(json.dumps(out, indent=2)); sys.exit(0 if out["ok"] else 1)
PY
PYSH

chmod +x Fixes/qa/phase7_e2e.sh
bash Fixes/qa/phase7_e2e.sh
