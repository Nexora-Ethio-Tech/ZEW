-- Remove unsafe legacy identities and their sessions. Private guest demos are retained.
DELETE FROM events WHERE session_id IN (SELECT id FROM sessions WHERE json_extract(state, '$.user.id') IS NOT NULL);
DELETE FROM sessions WHERE json_extract(state, '$.user.id') IS NOT NULL;
DELETE FROM users;
