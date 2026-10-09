-- Durable account workspaces and explicitly assigned cross-account requests.
CREATE TABLE workspaces (id TEXT PRIMARY KEY, state TEXT NOT NULL);
INSERT INTO workspaces SELECT id, state FROM sessions;
ALTER TABLE sessions ADD COLUMN workspace_id TEXT;
UPDATE sessions SET workspace_id = id;

CREATE TABLE accounts (
  id TEXT PRIMARY KEY, email TEXT NOT NULL, name TEXT NOT NULL,
  workspace_id TEXT NOT NULL UNIQUE REFERENCES workspaces(id)
);
INSERT INTO accounts (id, email, name, workspace_id)
SELECT json_extract(s.state, '$.user.id'), json_extract(s.state, '$.user.email'),
       json_extract(s.state, '$.user.name'), s.id
FROM sessions s WHERE json_extract(s.state, '$.user.id') IS NOT NULL
AND s.rowid = (SELECT s2.rowid FROM sessions s2
  WHERE json_extract(s2.state, '$.user.id') = json_extract(s.state, '$.user.id')
  ORDER BY s2.expires_at DESC, s2.rowid DESC LIMIT 1);
UPDATE sessions SET workspace_id = (SELECT a.workspace_id FROM accounts a
  WHERE a.id = json_extract(sessions.state, '$.user.id'))
WHERE json_extract(state, '$.user.id') IS NOT NULL;
UPDATE events SET session_id = (SELECT workspace_id FROM sessions WHERE sessions.id = events.session_id)
WHERE session_id IN (SELECT id FROM sessions);

CREATE TABLE driver_access (
  id TEXT PRIMARY KEY, email TEXT NOT NULL UNIQUE COLLATE NOCASE,
  user_id TEXT UNIQUE, name TEXT NOT NULL, vehicle TEXT NOT NULL,
  seats INTEGER NOT NULL CHECK(seats BETWEEN 1 AND 8),
  active INTEGER NOT NULL DEFAULT 1 CHECK(active IN (0,1))
);
INSERT INTO driver_access(id, email, name, vehicle, seats)
VALUES ('nexora-test-driver', 'nexoratechnologyplc@gmail.com', 'Nexora', 'Test vehicle', 4);
CREATE TABLE dispatch_settings (id INTEGER PRIMARY KEY CHECK(id = 1), test_driver_id TEXT REFERENCES driver_access(id));
INSERT INTO dispatch_settings VALUES (1, 'nexora-test-driver');

CREATE TABLE dispatch_requests (
  id TEXT PRIMARY KEY, kind TEXT NOT NULL CHECK(kind IN ('circle','planned')),
  workspace_id TEXT NOT NULL REFERENCES workspaces(id),
  driver_id TEXT NOT NULL REFERENCES driver_access(id),
  status TEXT NOT NULL, data TEXT NOT NULL, created_at TEXT NOT NULL, updated_at TEXT NOT NULL
);
CREATE INDEX dispatch_driver_status ON dispatch_requests(driver_id, status);
CREATE TABLE dispatch_events (
  id TEXT PRIMARY KEY, request_id TEXT NOT NULL REFERENCES dispatch_requests(id),
  actor_id TEXT NOT NULL, action TEXT NOT NULL, created_at TEXT NOT NULL
);
