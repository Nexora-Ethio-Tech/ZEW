// Host access is the authorization boundary. Never import into an HTTP route.
import { DatabaseSync } from 'node:sqlite';
import { randomUUID } from 'node:crypto';
if (process.env.DATABASE_URL) {
  await import('./postgres-operations.mjs');
} else {
  const [command, accountId] = process.argv.slice(2);
  const db = new DatabaseSync(process.env.DATABASE_PATH ?? './data/zew.sqlite', { open: true });
  db.exec('PRAGMA foreign_keys=ON; PRAGMA busy_timeout=5000');
  try {
    if (command === 'status') {
      const count = (table) => Number(db.prepare('SELECT COUNT(*) AS n FROM ' + table).get().n);
      console.log(
        JSON.stringify(
          {
            accounts: count('accounts'),
            workspaces: count('workspaces'),
            departures: count('planned_departures'),
            activeRequests: db
              .prepare(
                "SELECT status,COUNT(*) AS count FROM dispatch_requests WHERE status IN ('requested','accepted','in_progress') GROUP BY status",
              )
              .all(),
            trafficLastHour: db
              .prepare(
                'SELECT route,status,SUM(count) AS requests,ROUND(SUM(duration_ms)/SUM(count),1) AS averageMs FROM request_metrics WHERE minute>=? GROUP BY route,status',
              )
              .all(Math.floor(Date.now() / 60000) - 60),
            previewSettlements: count('preview_settlements'),
            simulated: true,
          },
          null,
          2,
        ),
      );
    } else if (command === 'revoke-sessions' && accountId) {
      db.exec('BEGIN IMMEDIATE');
      const account = db.prepare('SELECT workspace_id FROM accounts WHERE id=?').get(accountId);
      if (!account) throw new Error('Account not found. Use the confirmed provider account ID.');
      const result = db
        .prepare('DELETE FROM sessions WHERE workspace_id=?')
        .run(account.workspace_id);
      db.prepare('INSERT INTO operator_events VALUES (?,?,?,?)').run(
        randomUUID(),
        'sessions.revoked',
        result.changes,
        new Date().toISOString(),
      );
      db.exec('COMMIT');
      console.log(JSON.stringify({ revoked: Number(result.changes) }));
    } else if (command === 'maintenance') {
      db.exec('BEGIN IMMEDIATE');
      const sessions = db
        .prepare('DELETE FROM sessions WHERE expires_at<=?')
        .run(Date.now()).changes;
      db.prepare('DELETE FROM rate_limits WHERE expires_at<=?').run(Date.now());
      db.prepare('DELETE FROM booking_quotes WHERE booking_id IS NULL AND expires_at<=?').run(
        Date.now() - 86400000,
      );
      db.prepare('DELETE FROM request_metrics WHERE minute<?').run(
        Math.floor(Date.now() / 60000) - 30 * 24 * 60,
      );
      db.prepare('INSERT INTO operator_events VALUES (?,?,?,?)').run(
        randomUUID(),
        'maintenance',
        sessions,
        new Date().toISOString(),
      );
      db.exec('COMMIT');
      console.log(JSON.stringify({ expiredSessionsRemoved: Number(sessions) }));
    } else
      throw new Error(
        'Usage: operations.mjs status | maintenance | revoke-sessions <provider-account-id>',
      );
  } catch (error) {
    if (db.isTransaction) db.exec('ROLLBACK');
    console.error(error.message);
    process.exitCode = 1;
  } finally {
    db.close();
  }
}
