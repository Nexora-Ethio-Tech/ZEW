-- Migration 003: Users table and demo credentials
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'rider',
  created_at TEXT NOT NULL
);

-- Seed accounts (password: word123pass)
-- SHA256('word123pass') = a8adcd2d4dba9baa859db460f956b1f00a35000e448f662b97336d0d2664ca99
INSERT OR IGNORE INTO users (id, email, name, password_hash, role, created_at) VALUES
  ('user-rider-1', 'rider@zew.et', 'Demo Rider', 'a8adcd2d4dba9baa859db460f956b1f00a35000e448f662b97336d0d2664ca99', 'rider', '2026-10-08T00:00:00.000Z'),
  ('user-driver-1', 'driver@zew.et', 'Hana T. (Driver)', 'a8adcd2d4dba9baa859db460f956b1f00a35000e448f662b97336d0d2664ca99', 'driver', '2026-10-08T00:00:00.000Z'),
  ('user-operator-1', 'operator@zew.et', 'Support Operator', 'a8adcd2d4dba9baa859db460f956b1f00a35000e448f662b97336d0d2664ca99', 'operator', '2026-10-08T00:00:00.000Z'),
  ('user-yonas-1', 'yonas@zew.et', 'Yonas M.', 'a8adcd2d4dba9baa859db460f956b1f00a35000e448f662b97336d0d2664ca99', 'rider', '2026-10-08T00:00:00.000Z');
