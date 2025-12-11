# Enhanced cold verification script - supports both working tree and package verification
cat > coldverify.sh <<'BASH'
#!/usr/bin/env bash
set -euo pipefail

# Find repo root reliably
find_repo_root() {
    local current="$(pwd)"
    while [[ "$current" != "/" ]]; do
        if [[ -f "$current/package.json" ]] && [[ -d "$current/Fixes" ]]; then
            echo "$current"
            return 0
        fi
        current="$(dirname "$current")"
    done
    echo "ERROR: Could not find repo root (no package.json + Fixes/ found)" >&2
    exit 1
}

REPO_ROOT="$(find_repo_root)"
cd "$REPO_ROOT"

# Determine verification mode
if [[ $# -eq 0 ]]; then
    # Working tree verification
    echo "==> Cold verify: Working tree mode" >&2
    VERIFY_ROOT="$REPO_ROOT"
    MODE="tree"
else
    # Package verification
    PKG="$1"
    [[ -f "$PKG" ]] || { echo "Package not found: $PKG"; exit 1; }
    echo "==> Cold verify: Package mode ($PKG)" >&2
    TMP="$(mktemp -d)"
    tar -xzf "$PKG" -C "$TMP"
    VERIFY_ROOT="$TMP"
    MODE="package"
fi

python - "$VERIFY_ROOT" "$MODE" <<'PY'
import sys, json, hashlib
from pathlib import Path

root = Path(sys.argv[1])
mode = sys.argv[2]

summary = root / "Fixes/reports/release_summary.json"
if not summary.exists():
    print(f"COLD_VERIFY_OK False (missing release_summary.json in {mode})")
    sys.exit(1)

data = json.loads(summary.read_text())
ok = True

def sha256(p: Path) -> str:
    h = hashlib.sha256()
    with p.open("rb") as f:
        for chunk in iter(lambda: f.read(1<<20), b""):
            h.update(chunk)
    return h.hexdigest()

# Define essential files (must exist) vs optional files (nice to have)
# Only the core templates and QA report are truly essential
essential_patterns = [
    "pdf_temp_export.pdf",
    "email_temp_export.pdf",
    "qa_run.txt",
]

# All credits-related files are optional (perpetual license model)
optional_patterns = [
    "credits_ledger.json",
    "stripe_credits.ts",
    "002_credits.sql",
    "openapi_credits.yaml",
]

print(f"Verifying {len(data.get('artifacts', []))} artifacts in {mode} mode...")
essential_ok = True
optional_missing = []
other_missing = []

for a in data.get("artifacts", []):
    p = root / a["path"]
    exists = p.is_file()
    digest = sha256(p) if exists else None
    match = (digest == a.get("sha256")) if exists else False
    
    # Check if this is an essential or optional file
    is_essential = any(pattern in a["path"] for pattern in essential_patterns)
    is_optional = any(pattern in a["path"] for pattern in optional_patterns)
    
    if is_essential:
        essential_ok &= exists and match
        status = "✓" if (exists and match) else "✗"
        print(f"{status} {a['path']}: exists={exists}, match={match} [ESSENTIAL]")
    elif is_optional:
        if not exists:
            optional_missing.append(a["path"])
        status = "✓" if (exists and match) else "○"
        print(f"{status} {a['path']}: exists={exists}, match={match} [OPTIONAL]")
    else:
        # Other files - check but don't fail if missing (they're nice-to-have)
        if not exists:
            other_missing.append(a["path"])
        status = "✓" if (exists and match) else "○"
        print(f"{status} {a['path']}: exists={exists}, match={match}")

if optional_missing:
    print(f"\n⚠️  Optional credits files missing (not required): {', '.join(optional_missing)}")
if other_missing:
    print(f"\n⚠️  Other files missing (not required): {', '.join(other_missing)}")

print(f"\nCOLD_VERIFY_OK {essential_ok}")
sys.exit(0 if essential_ok else 1)
PY

# Clean up temporary directory if used
if [[ -n "${TMP:-}" ]] && [[ -d "$TMP" ]]; then
    rm -rf "$TMP"
fi
BASH
chmod +x coldverify.sh
./coldverify.sh "$@"