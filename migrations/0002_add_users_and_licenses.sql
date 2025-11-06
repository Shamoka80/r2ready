
-- Users table
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  company_name TEXT NOT NULL,
  phone TEXT,
  password_hash TEXT,
  account_type TEXT NOT NULL CHECK (account_type IN ('business', 'consultant')),
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at INTEGER NOT NULL DEFAULT (unixepoch())
);

-- Licenses table  
CREATE TABLE IF NOT EXISTS licenses (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id),
  plan_id TEXT NOT NULL,
  plan_name TEXT NOT NULL,
  stripe_session_id TEXT UNIQUE,
  stripe_payment_intent_id TEXT,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'suspended', 'expired')),
  features TEXT NOT NULL, -- JSON string of plan features
  max_facilities INTEGER NOT NULL DEFAULT 1,
  max_seats INTEGER NOT NULL DEFAULT 1,
  max_clients INTEGER DEFAULT NULL, -- For consultants only
  amount_paid INTEGER NOT NULL, -- Amount in cents
  purchased_at INTEGER NOT NULL DEFAULT (unixepoch()),
  expires_at INTEGER DEFAULT NULL -- NULL for perpetual licenses
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_licenses_user_id ON licenses(user_id);
CREATE INDEX IF NOT EXISTS idx_licenses_stripe_session ON licenses(stripe_session_id);
