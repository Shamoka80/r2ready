#!/usr/bin/env bash
set -euo pipefail

ROOT="${PWD}"
FIX="${FIX:-./Fixes}"
OUTD="${OUTD:-$FIX/reports}"
TMPL1="$FIX/pdf_temp_export.pdf"
TMPL2="$FIX/email_temp_export.pdf"
mkdir -p "$OUTD"

echo "==> Check templates"
for f in "$TMPL1" "$TMPL2"; do
  [[ -f "$f" ]] || { echo "MISSING: $f"; exit 1; }
  ls -lh "$f"
done

echo "==> Ensure tracked in git"
grep -q '!Fixes/pdf_temp_export.pdf' .gitignore 2>/dev/null || \
  printf '\n!Fixes/pdf_temp_export.pdf\n' >> .gitignore
grep -q '!Fixes/email_temp_export.pdf' .gitignore 2>/dev/null || \
  printf '!Fixes/email_temp_export.pdf\n' >> .gitignore
git add -f "$TMPL1" "$TMPL2" .gitignore || true
git diff --cached --quiet || git commit -m "Templates: ensure tracked"

echo "==> Build release (Phase 7)"
if [[ -x ./phase7_release.sh ]]; then
  bash ./phase7_release.sh
elif [[ -x ./phase7_bootstrap_and_run.sh ]]; then
  bash ./phase7_bootstrap_and_run.sh
else
  echo "No release script found"; exit 1
fi
PKG="$(ls -t releases/rur2_prelaunch_*.tar.gz | head -1)"
echo "PACKAGE: $PKG"

echo "==> Local cold verify"
bash ./coldver.sh "$PKG" | tee "$OUTD/coldver_ci.txt"
COLD_OK=$(grep -q 'COLD_VERIFY_OK True' "$OUTD/coldver_ci.txt" && echo true || echo false)

echo "==> Phases 0–5 E2E"
set +e
bash ./e2e_0_5.sh | tee "$OUTD/e2e_0_5_ci.txt"
E2E_RC=$?
set -e

echo "==> Trigger CI on GitHub"
git commit --allow-empty -m "ci: trigger after template upload + release" >/dev/null 2>&1 || true
git push || true

echo "==> Summary"
printf '{\n  "package":"%s",\n  "cold_verify_ok": %s,\n  "e2e_exit_code": %s,\n  "artifacts":["%s","%s"]\n}\n' \
  "$PKG" "$COLD_OK" "$E2E_RC" "$OUTD/coldver_ci.txt" "$OUTD/e2e_0_5_ci.txt"
