import { randomUUID } from 'node:crypto';
import { postgresPool } from '../dist/shared/postgres-pool.js';
const pool = postgresPool(process.env.DATABASE_URL),
  [command, accountId] = process.argv.slice(2);
const connection = await pool.connect();
try {
  if (command === 'status') {
    const counts = (
      await connection.query(`SELECT (SELECT count(*) FROM zew.accounts)::int AS accounts,
    (SELECT count(*) FROM zew.workspaces)::int AS workspaces,(SELECT count(*) FROM zew.planned_departures)::int AS departures,
    (SELECT count(*) FROM zew.preview_settlements)::int AS "previewSettlements"`)
    ).rows[0];
    const traffic = (
      await connection.query(
        'SELECT route,status,SUM(count)::int AS requests,ROUND((SUM(duration_ms)/SUM(count))::numeric,1) AS "averageMs" FROM zew.request_metrics WHERE minute >= $1 GROUP BY route,status',
        [Math.floor(Date.now() / 60000) - 60],
      )
    ).rows;
    console.log(JSON.stringify({ ...counts, trafficLastHour: traffic, simulated: true }, null, 2));
  } else if (command === 'maintenance' || (command === 'revoke-sessions' && accountId)) {
    await connection.query('BEGIN');
    let affected = 0;
    if (command === 'maintenance') {
      affected = (
        await connection.query('DELETE FROM zew.sessions WHERE expires_at<=$1', [Date.now()])
      ).rowCount;
      await connection.query('DELETE FROM zew.rate_limits WHERE expires_at<=$1', [Date.now()]);
      await connection.query(
        'DELETE FROM zew.booking_quotes WHERE booking_id IS NULL AND expires_at<=$1',
        [Date.now() - 86400000],
      );
      await connection.query('DELETE FROM zew.request_metrics WHERE minute<$1', [
        Math.floor(Date.now() / 60000) - 30 * 24 * 60,
      ]);
    } else {
      const account = (
        await connection.query('SELECT workspace_id FROM zew.accounts WHERE id=$1', [accountId])
      ).rows[0];
      if (!account) throw new Error('Account not found.');
      affected = (
        await connection.query('DELETE FROM zew.sessions WHERE workspace_id=$1', [
          account.workspace_id,
        ])
      ).rowCount;
    }
    await connection.query('INSERT INTO zew.operator_events VALUES($1,$2,$3,$4)', [
      randomUUID(),
      command,
      affected,
      new Date().toISOString(),
    ]);
    await connection.query('COMMIT');
    console.log(JSON.stringify({ command, affected }));
  } else
    throw new Error(
      'Usage: operations.mjs status | maintenance | revoke-sessions <provider-account-id>',
    );
} catch (error) {
  await connection.query('ROLLBACK');
  console.error(error.message);
  process.exitCode = 1;
} finally {
  connection.release();
  await pool.end();
}
