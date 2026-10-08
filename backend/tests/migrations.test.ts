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
  assert.equal(migrations.count, 5);
  const trips = db.prepare('SELECT departure FROM trips').all();
  assert.equal(trips.length, 3);
  for (const row of trips) assert.ok(Date.parse(row.departure as string) > Date.now());
});
