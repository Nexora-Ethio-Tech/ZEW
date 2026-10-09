// One-time operator import. Run against a consistent SQLite backup, never a live WAL file.
import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { postgresPool } from '../src/shared/postgres-pool.js';
const source = process.argv[2];
if (!source || !process.env.DATABASE_URL)
  throw new Error(
    'Usage: DATABASE_URL configured; migrate-to-postgres.ts <verified-sqlite-snapshot>',
  );
const digest = createHash('sha256').update(readFileSync(source)).digest('hex');
const db = new DatabaseSync(source, { readOnly: true }),
  pool = postgresPool(process.env.DATABASE_URL);
const tables = [
  'group_catalog',
  'planned_catalog',
  'workspaces',
  'sessions',
  'accounts',
  'driver_access',
  'dispatch_settings',
  'planned_departures',
  'dispatch_requests',
  'events',
  'dispatch_events',
  'mutation_receipts',
  'rate_limits',
  'preview_settlements',
  'booking_quotes',
  'request_metrics',
  'operator_events',
];
const connection = await pool.connect();
try {
  if (
    db.prepare('PRAGMA integrity_check').get()!.integrity_check !== 'ok' ||
    db.prepare('PRAGMA foreign_key_check').all().length
  )
    throw new Error('SQLite integrity check failed.');
  await connection.query('BEGIN');
  await connection.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))', [
    'zew:workspace-writes',
  ]);
  if (
    (
      await connection.query(
        "SELECT name FROM zew.schema_migrations WHERE name LIKE 'sqlite-import:%'",
      )
    ).rowCount
  )
    throw new Error(
      'A SQLite import has already been recorded. Existing cloud data was not overwritten.',
    );
  for (const table of tables)
    if (Number((await connection.query(`SELECT count(*) AS n FROM zew.${table}`)).rows[0].n) > 0)
      throw new Error('The destination contains data. Import refuses to overwrite it.');
  const counts: Record<string, number> = {};
  for (const table of tables) {
    const rows = db.prepare('SELECT * FROM ' + table).all();
    counts[table] = rows.length;
    for (const row of rows) {
      const columns = Object.keys(row);
      if (columns.some((column) => !/^[a-z_]+$/.test(column)))
        throw new Error('Unexpected column name.');
      await connection.query(
        `INSERT INTO zew.${table} (${columns.map((c) => '"' + c + '"').join(',')}) VALUES (${columns.map((_, i) => '$' + (i + 1)).join(',')})`,
        Object.values(row),
      );
    }
    const copied = Number(
      (await connection.query(`SELECT count(*) AS n FROM zew.${table}`)).rows[0].n,
    );
    if (copied !== rows.length) throw new Error('Row-count verification failed for ' + table);
  }
  await connection.query('INSERT INTO zew.schema_migrations VALUES($1,$2)', [
    'sqlite-import:' + digest,
    new Date().toISOString(),
  ]);
  await connection.query('COMMIT');
  console.log(JSON.stringify({ imported: true, counts }));
} catch (error) {
  await connection.query('ROLLBACK');
  throw error;
} finally {
  connection.release();
  await pool.end();
  db.close();
}
