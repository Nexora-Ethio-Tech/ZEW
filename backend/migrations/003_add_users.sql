-- Migration 003: Users table and demo credentials
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'rider',
  created_at TEXT NOT NULL
);

-- Seed demo accounts (password: password123)
-- SHA256('password123') = ef92b778bafe771e89245b89ecbc08a44a4e166c06659911881f383d4473e94f
INSERT OR IGNORE INTO users (id, email, name, password_hash, role, created_at) VALUES
  ('user-rider-1', 'rider@zew.et', 'Demo Rider', 'ef92b778bafe771e89245b89ecbc08a44a4e166c06659911881f383d4473e94f', 'rider', '2026-10-08T00:00:00.000Z'),
  ('user-driver-1', 'driver@zew.et', 'Hana T. (Driver)', 'ef92b778bafe771e89245b89ecbc08a44a4e166c06659911881f383d4473e94f', 'driver', '2026-10-08T00:00:00.000Z'),
  ('user-operator-1', 'operator@zew.et', 'Support Operator', 'ef92b778bafe771e89245b89ecbc08a44a4e166c06659911881f383d4473e94f', 'operator', '2026-10-08T00:00:00.000Z'),
  ('user-yonas-1', 'yonas@zew.et', 'Yonas M.', 'ef92b778bafe771e89245b89ecbc08a44a4e166c06659911881f383d4473e94f', 'rider', '2026-10-08T00:00:00.000Z');
