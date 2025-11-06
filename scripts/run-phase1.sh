#!/usr/bin/env bash
set -euo pipefail

# CONFIG
TARGET_TS="scripts/test-phase1-multi-facility.ts"
WRAPPER_TS="scripts/_wrap-phase1.ts"
BOOTSTRAP_TS="scripts/_bootstrap.ts"
TEMP_TSCONFIG="tsconfig.tsx-run.json"
LOG_FILE="logs/phase1-run.$(date +%Y%m%d-%H%M%S).log"

# ---------- helpers ----------
require_cmd() {
  command -v "$1" >/dev/null 2>&1 || { echo "Missing required command: $1" >&2; exit 1; }
}
ensure_dir() { mkdir -p "$1"; }

ensure_dev_dep() {
  local dep="$1"
  if ! node -e "const p=require('./package.json'); const d={...p.devDependencies,...p.dependencies}; if(!(d&&d['$dep'])) process.exit(1)" >/dev/null 2>&1; then
    echo "Installing $dep..."
    npm i -D "$dep"
  fi
}

append_env_if_missing() {
  local key="$1" val="$2"
  touch .env
  if ! grep -qE "^${key}=" .env; then
    echo "${key}=${val}" >> .env
    echo "Set ${key} in .env"
  fi
}

# ---------- preflight ----------
require_cmd node
require_cmd npm
node -v
npm -v

ensure_dir logs
ensure_dir scripts

# ---------- deps ----------
ensure_dev_dep tsx
ensure_dev_dep typescript
ensure_dev_dep @types/node
ensure_dev_dep dotenv

# ---------- drizzle non-interactive ----------
ensure_dev_dep drizzle-kit

export CI=1
export DRIZZLE_KIT_NO_PROMPT=1   # ignored by some versions, keep for future-proofing

if npx drizzle-kit --help >/dev/null 2>&1; then
  echo "Applying schema with drizzle-kit push (non-interactive)."
  # --force auto-accepts destructive/rename prompts
  npx drizzle-kit push --strict --verbose --force || {
    echo "push failed; trying generate+migrate"
    npx drizzle-kit generate --verbose --force
    npx drizzle-kit migrate --verbose
  }
else
  echo "drizzle-kit not found in PATH"; exit 1
fi

# ---------- env ----------
# Load or create sane defaults for JWT secrets if missing
# DATABASE_URL is not guessed. If absent, script still runs but DB calls may fail in your app code.
if [[ ! -f .env ]]; then touch .env; fi

# Generate a strong JWT secret if missing
JWT_GEN=$(node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))")
append_env_if_missing "JWT_SECRET" "${JWT_GEN}"
append_env_if_missing "JWT_ACTIVE_KID" "kid-$(date +%s)"

# Ensure NODE_ENV default
append_env_if_missing "NODE_ENV" "development"

echo "Current required envs present (JWT*). If your script needs DATABASE_URL, STRIPE_*, or NEON_*, add them to .env."

# ---------- bootstrap shim ----------
if [[ ! -f "${BOOTSTRAP_TS}" ]]; then
  cat > "${BOOTSTRAP_TS}" <<'TS'
import 'dotenv/config';

// Hard fail on unhandled errors for CI-like determinism
process.on('unhandledRejection', (e) => { console.error(e); process.exit(1); });
process.on('uncaughtException', (e) => { console.error(e); process.exit(1); });

// Optional: echo key envs for visibility (mask sensitive sections)
const mask = (s?: string) => s ? (s.length > 8 ? s.slice(0,4) + '...' + s.slice(-4) : '****') : 'unset';
console.error('[env] NODE_ENV=', process.env.NODE_ENV || 'unset');
console.error('[env] DATABASE_URL=', mask(process.env.DATABASE_URL));
console.error('[env] JWT_SECRET=', mask(process.env.JWT_SECRET));
console.error('[env] JWT_ACTIVE_KID=', process.env.JWT_ACTIVE_KID || 'unset');
TS
fi

# ---------- wrapper runner (does not modify your original script) ----------
cat > "${WRAPPER_TS}" <<TS
import './_bootstrap';
await import('./$(basename "${TARGET_TS}")');
TS

# ---------- minimal tsconfig used only for tsx run ----------
cat > "${TEMP_TSCONFIG}" <<'JSON'
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "lib": ["ES2022"],
    "skipLibCheck": true,
    "noEmit": true,
    "types": ["node"],
    "baseUrl": ".",
    "paths": { "@/*": ["src/*"] }
  }
}
JSON

# ---------- sanity checks ----------
if [[ ! -f "${TARGET_TS}" ]]; then
  echo "ERROR: ${TARGET_TS} not found." >&2
  exit 1
fi

# Warn on missing DATABASE_URL if Drizzle is detected
if (npm pkg get devDependencies.drizzle-orm >/dev/null 2>&1 || npm pkg get dependencies.drizzle-orm >/dev/null 2>&1) \
   && ! grep -qE "^DATABASE_URL=" .env; then
  echo "WARN: DATABASE_URL not set. DB operations may fail." >&2
fi

# ---------- run ----------
echo "Running with diagnostics. Log: ${LOG_FILE}"
set +e
NODE_OPTIONS="--trace-warnings" TSX_DEBUG=true npx tsx --tsconfig "${TEMP_TSCONFIG}" "${WRAPPER_TS}" 2>&1 | tee "${LOG_FILE}"
EXIT_CODE=${PIPESTATUS[0]}
set -e

if [[ ${EXIT_CODE} -ne 0 ]]; then
  echo "Script failed. Showing last 50 log lines:"
  tail -n 50 "${LOG_FILE}"
  exit ${EXIT_CODE}
fi

echo "Completed successfully."