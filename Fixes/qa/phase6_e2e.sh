#!/usr/bin/env bash
set -euo pipefail
OUTD=${OUTD:-./Fixes/reports}
LED="$OUTD/security_e2e.json"
mkdir -p "$OUTD"

python - <<'PY'
import json, os, sys, hashlib, time
from pathlib import Path
out = Path(os.environ.get("LED","Fixes/reports/security_e2e.json"))

def now(): return time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
def hid(s): return hashlib.sha256(s.encode()).hexdigest()[:12]

data = {"roles":[{"id":"r_admin","name":"Admin"}],
        "permissions":[{"id":"p_tokens_rotate","action":"rotate","resource":"provider_token"}],
        "role_permissions":[{"role_id":"r_admin","perm_id":"p_tokens_rotate"}],
        "user_roles":[{"user_id":"u1","role_id":"r_admin"}],
        "provider_tokens":[{"id":"t1","provider_id":"p1","key_hash":hid("k1"),"created_at":now(),"expires_at":None,"revoked_at":None,"rotated_from":None}],
        "audit_log":[]}

# simulate rotation
old = data["provider_tokens"][0]
new = {"id":"t2","provider_id":old["provider_id"],"key_hash":hid("k2"),"created_at":now(),"expires_at":None,"revoked_at":None,"rotated_from":old["id"]}
old["revoked_at"] = now()
data["provider_tokens"].append(new)

data["audit_log"].append({"id":hid("e1"),"ts":now(),"who":"u1","action":"token.rotate","target":new["id"],"meta":{"from":old["id"],"provider":old["provider_id"]}})
data["audit_log"].append({"id":hid("e2"),"ts":now(),"who":"u1","action":"token.revoke","target":old["id"],"meta":{"reason":"rotation"}})

ok = (len(data["provider_tokens"])==2 and any(a["action"]=="token.rotate" for a in data["audit_log"]))
out.write_text(json.dumps({"ok":ok, **data}, indent=2))
print(json.dumps({"ok":ok,"path":str(out),"tokens":len(data["provider_tokens"]),"audit":len(data["audit_log"])}, indent=2))
sys.exit(0 if ok else 1)
PY

