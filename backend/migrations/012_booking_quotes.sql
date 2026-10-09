CREATE TABLE booking_quotes (
 id TEXT PRIMARY KEY,
 workspace_id TEXT NOT NULL REFERENCES workspaces(id),
 snapshot TEXT NOT NULL,
 expires_at INTEGER NOT NULL,
 booking_id TEXT
);
CREATE INDEX booking_quotes_expiry ON booking_quotes(expires_at);
