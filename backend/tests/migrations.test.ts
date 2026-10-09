import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { runMigrations } from '../src/shared/migrate.js';

test('fresh and repeated migrations create no password accounts and use future Addis seed departures', (t) => {
  const directory = mkdtempSync(join(tmpdir(), 'zew-migrations-'));
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  const path = join(directory, 'test.sqlite');
  runMigrations(path);
  runMigrations(path);
  const db = new DatabaseSync(path);
  t.after(() => db.close());
  assert.equal(db.prepare('SELECT COUNT(*) AS count FROM users').get()!.count, 0);
  const migrations = db.prepare('SELECT COUNT(*) AS count FROM schema_migrations').get()!;
  assert.equal(migrations.count, 13);
  assert.equal(
    db.prepare('SELECT COUNT(*) AS count FROM driver_access WHERE user_id IS NULL').get()!.count,
    1,
  );
  const catalog = db.prepare('SELECT key, data FROM group_catalog').all() as {
    key: string;
    data: string;
  }[];
  assert.equal(catalog.length, 8);
  assert.equal(JSON.parse(catalog.find((row) => row.key === 'riders')!.data).length, 199);
  const planned = db.prepare('SELECT key, data FROM planned_catalog').all() as {
    key: string;
    data: string;
  }[];
  assert.equal(JSON.parse(planned.find((row) => row.key === 'trips')!.data).length, 18);
  const trips = db.prepare('SELECT departure FROM trips').all();
  assert.equal(trips.length, 3);
  for (const row of trips) assert.ok(Date.parse(row.departure as string) > Date.now());
});

test('upgrade preserves existing assignments and backfills shared departures and simulated settlements', async (t) => {
  const { readdirSync, readFileSync } = await import('node:fs');
  const directory = mkdtempSync(join(tmpdir(), 'zew-upgrade-')),
    path = join(directory, 'db.sqlite');
  const db = new DatabaseSync(path);
  t.after(() => {
    db.close();
    rmSync(directory, { recursive: true, force: true });
  });
  db.exec('CREATE TABLE schema_migrations(name TEXT PRIMARY KEY,executed_at TEXT NOT NULL)');
  const migrations = new URL('../migrations/', import.meta.url);
  for (const name of readdirSync(migrations)
    .filter((name) => name.endsWith('.sql') && name < '011')
    .sort()) {
    db.exec(readFileSync(new URL(name, migrations), 'utf8'));
    db.prepare('INSERT INTO schema_migrations VALUES (?,?)').run(name, new Date().toISOString());
  }
  db.prepare('INSERT INTO workspaces VALUES (?,?)').run('legacy', '{"bookings":[]}');
  for (const id of ['first', 'second'])
    db.prepare('INSERT INTO dispatch_requests VALUES (?,?,?,?,?,?,?,?)').run(
      id,
      'planned',
      'legacy',
      'nexora-test-driver',
      'completed',
      JSON.stringify({ tripId: 'trip', departure: '2026-10-10T06:00:00Z', fare: 100, payout: 90 }),
      new Date().toISOString(),
      new Date().toISOString(),
    );
  runMigrations(path, db);
  runMigrations(path, db);
  assert.equal(db.prepare('SELECT COUNT(*) AS n FROM planned_departures').get()!.n, 1);
  assert.equal(
    db.prepare('SELECT COUNT(DISTINCT departure_id) AS n FROM dispatch_requests').get()!.n,
    1,
  );
  assert.equal(
    db.prepare('SELECT SUM(payout_minor) AS n FROM preview_settlements').get()!.n,
    18000,
  );
  assert.equal(
    db.prepare('SELECT workspace_id FROM dispatch_requests LIMIT 1').get()!.workspace_id,
    'legacy',
  );
  assert.equal(db.prepare('PRAGMA foreign_key_check').all().length, 0);
});
