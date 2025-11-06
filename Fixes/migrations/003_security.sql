-- RBAC
CREATE TABLE IF NOT EXISTS roles (
  id TEXT PRIMARY KEY, name TEXT NOT NULL UNIQUE
);
CREATE TABLE IF NOT EXISTS permissions (
  id TEXT PRIMARY KEY, action TEXT NOT NULL, resource TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS role_permissions (
  role_id TEXT NOT NULL, perm_id TEXT NOT NULL,
  PRIMARY KEY (role_id, perm_id)
);
CREATE TABLE IF NOT EXISTS user_roles (
  user_id TEXT NOT NULL, role_id TEXT NOT NULL,
  PRIMARY KEY (user_id, role_id)
);

-- Provider tokens (rotation/revocation)
CREATE TABLE IF NOT EXISTS provider_tokens (
  id TEXT PRIMARY KEY,
  provider_id TEXT NOT NULL,
  key_hash TEXT NOT NULL,
  created_at TEXT NOT NULL,
  expires_at TEXT,
  revoked_at TEXT,
  rotated_from TEXT
);

-- Audit log
CREATE TABLE IF NOT EXISTS audit_log (
  id TEXT PRIMARY KEY,
  ts TEXT NOT NULL,
  who TEXT,
  action TEXT NOT NULL,
  target TEXT,
  meta TEXT
);

CREATE INDEX IF NOT EXISTS idx_audit_ts ON audit_log(ts);
CREATE INDEX IF NOT EXISTS idx_token_provider ON provider_tokens(provider_id);
