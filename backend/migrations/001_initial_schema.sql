-- Migration 001: Initial Schema
-- Core schemas for sessions, events, corridors, trips, commutes, and bookings

CREATE TABLE IF NOT EXISTS schema_migrations (
  name TEXT PRIMARY KEY,
  executed_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,
  token_hash TEXT UNIQUE NOT NULL,
  state TEXT NOT NULL,
  expires_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS events (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL,
  kind TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS corridors (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  stops TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS trips (
  id TEXT PRIMARY KEY,
  corridor_id TEXT NOT NULL,
  origin TEXT NOT NULL,
  destination TEXT NOT NULL,
  departure TEXT NOT NULL,
  seats INTEGER NOT NULL,
  driver TEXT NOT NULL,
  vehicle TEXT NOT NULL,
  fare INTEGER NOT NULL,
  source TEXT NOT NULL DEFAULT 'sample',
  status TEXT NOT NULL DEFAULT 'open'
);

CREATE TABLE IF NOT EXISTS commutes (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL,
  name TEXT NOT NULL,
  corridor_id TEXT NOT NULL,
  origin TEXT NOT NULL,
  destination TEXT NOT NULL,
  departure TEXT NOT NULL,
  seats INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS bookings (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL,
  trip_id TEXT NOT NULL,
  driver TEXT NOT NULL,
  vehicle TEXT NOT NULL,
  origin TEXT NOT NULL,
  destination TEXT NOT NULL,
  fare INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'confirmed',
  code TEXT NOT NULL,
  created_at TEXT NOT NULL,
  payment TEXT NOT NULL DEFAULT 'not_due'
);
