import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { buildApp } from '../src/app.js';
import { runMigrations } from '../src/shared/migrate.js';

test('API prices and group applicants come from the SQLite catalog', async (t) => {
  const directory = mkdtempSync(join(tmpdir(), 'zew-catalog-'));
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  const path = join(directory, 'catalog.sqlite');
  runMigrations(path);
  const db = new DatabaseSync(path);
  const fareRow = db.prepare("SELECT data FROM group_catalog WHERE key = 'destinations'").get()!;
  const destinations = JSON.parse(fareRow.data as string) as { id: string; fare: number }[];
  destinations.find((item) => item.id === 'meskel')!.fare = 480;
  db.prepare("UPDATE group_catalog SET data = ? WHERE key = 'destinations'").run(JSON.stringify(destinations));
  db.close();

  const app = buildApp({ databasePath: path });
  t.after(() => app.close());
  const preview = (await app.inject('/api/v1/fare-preview')).json();
  assert.equal(preview.total, 480);
  const token = (await app.inject({ method: 'POST', url: '/api/v1/session' })).json().token;
  const pool = (await app.inject({
    method: 'POST', url: '/api/v1/pool/bootstrap', headers: { authorization: `Bearer ${token}` },
  })).json();
  assert.equal(pool.quote.total, 480);
  assert.equal(pool.riders.filter((rider: { corridorId?: string }) => rider.corridorId).length, 182);
});
