#!/usr/bin/env bash
set -euo pipefail

LEDGER=${LEDGER:-Fixes/reports/credits_ledger.json}
mkdir -p "$(dirname "$LEDGER")"

python - <<'PY'
import json, shutil
from pathlib import Path

L = Path("Fixes/reports/credits_ledger.json")
L.parent.mkdir(parents=True, exist_ok=True)

def backup():
    if L.exists():
        b = L.with_suffix(".bak")
        shutil.copyfile(L, b)

def normalize(lst):
    fixed = []
    for item in lst:
        if not isinstance(item, dict): 
            continue
        t = item.get("type") or item.get("kind") or item.get("action") or item.get("event") or item.get("op")
        if not t:
            continue
        item["type"] = t
        fixed.append(item)
    return fixed

if not L.exists():
    L.write_text("[]")
else:
    try:
        data = json.loads(L.read_text())
    except Exception:
        backup(); L.write_text("[]")
    else:
        if not isinstance(data, list):
            backup(); L.write_text("[]")
        else:
            fixed = normalize(data)
            if fixed != data:
                backup(); L.write_text(json.dumps(fixed, indent=2))
print("LEDGER_READY")
PY

# re-run Phase 5 checks
bash Fixes/qa/phase5_smoke.sh
bash Fixes/qa/phase5_e2e.sh
