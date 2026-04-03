-- Kaiwu D1 Database Schema
-- Run: wrangler d1 execute kaiwu-db --file=schema.sql

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  privy_id TEXT UNIQUE NOT NULL,
  email TEXT,
  name TEXT,
  monthly_credits INTEGER DEFAULT 1000,
  credits_used INTEGER DEFAULT 0,
  credits_reset_at TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS api_keys (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id),
  name TEXT DEFAULT 'default',
  key_hash TEXT NOT NULL,
  key_prefix TEXT NOT NULL,
  type TEXT DEFAULT 'dev',
  usage_count INTEGER DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now')),
  last_used_at TEXT,
  revoked INTEGER DEFAULT 0
);

CREATE TABLE IF NOT EXISTS usage_logs (
  id TEXT PRIMARY KEY,
  api_key_id TEXT NOT NULL,
  endpoint TEXT NOT NULL,
  credits_used INTEGER DEFAULT 1,
  query TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_api_keys_user ON api_keys(user_id);
CREATE INDEX IF NOT EXISTS idx_api_keys_prefix ON api_keys(key_prefix);
CREATE INDEX IF NOT EXISTS idx_usage_logs_key ON usage_logs(api_key_id);
CREATE INDEX IF NOT EXISTS idx_users_privy ON users(privy_id);
