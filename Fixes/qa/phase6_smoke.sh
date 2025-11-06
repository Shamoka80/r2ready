#!/usr/bin/env bash
set -euo pipefail
FIX=${FIX:-./Fixes}
ok=1
for f in "$FIX/api/openapi_security.yaml" "$FIX/contracts/rbac_contracts.ts" "$FIX/migrations/003_security.sql"; do
  if [ ! -s "$f" ]; then echo "MISS $f"; ok=0; else echo "OK $f"; fi
done
grep -q "CREATE TABLE IF NOT EXISTS roles" "$FIX/migrations/003_security.sql" || { echo "MISS roles table"; ok=0; }
grep -q "provider_tokens" "$FIX/migrations/003_security.sql" || { echo "MISS provider_tokens"; ok=0; }
grep -q "audit_log" "$FIX/migrations/003_security.sql" || { echo "MISS audit_log"; ok=0; }
[ $ok -eq 1 ] && echo "Phase6_SMOKE: PASS" || { echo "Phase6_SMOKE: FAIL"; exit 1; }
