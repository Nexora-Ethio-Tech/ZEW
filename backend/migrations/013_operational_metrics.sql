CREATE TABLE request_metrics (
 minute INTEGER NOT NULL,
 route TEXT NOT NULL,
 status INTEGER NOT NULL,
 count INTEGER NOT NULL,
 duration_ms REAL NOT NULL,
 PRIMARY KEY(minute,route,status)
);
CREATE TABLE operator_events (
 id TEXT PRIMARY KEY,
 action TEXT NOT NULL,
 affected INTEGER NOT NULL,
 created_at TEXT NOT NULL
);
