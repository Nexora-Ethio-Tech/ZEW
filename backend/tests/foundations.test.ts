import { test, type TestContext } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { mkdtempSync, rmSync, statSync, appendFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { buildApp } from '../src/app.js';
import { backupDatabase, restoreDatabase } from '../scripts/database-recovery.mjs';
import { reserveTrip } from './helpers.js';

async function fixture(t: TestContext) {
  const directory = mkdtempSync(join(tmpdir(), 'zew-foundations-')),
    path = join(directory, 'db.sqlite');
  const verifyIdentity = async (id: string) => ({
    id,
    email: id === 'driver' ? 'nexoratechnologyplc@gmail.com' : id + '@example.com',
    name: id,
    emailConfirmed: true,
  });
  let app = buildApp({ databasePath: path, verifyIdentity });
  const db = new DatabaseSync(path);
  t.after(async () => {
    db.close();
    await app.close();
    rmSync(directory, { recursive: true, force: true });
  });
  const login = async (id: string) => ({
    authorization:
      'Bearer ' +
      (
        await app.inject({
          method: 'POST',
          url: '/api/v1/auth/session',
          headers: { authorization: 'Bearer ' + id },
        })
      ).json().token,
  });
  const rider = await login('rider'),
    other = await login('other'),
    driver = await login('driver');
  const call = (headers: Record<string, string>, url: string, payload?: object, key?: string) =>
    app.inject({
      method: payload ? 'POST' : 'GET',
      url: '/api/v1' + url,
      headers: { ...headers, ...(key ? { 'idempotency-key': key } : {}) },
      payload,
    });
  const trip = (await call(rider, '/dashboard'))
    .json()
    .trips.find((t: { id: string }) => t.id === 'sample-hana');
  const journey = {
    corridorId: trip.corridorId,
    origin: 'bole',
    destination: 'meskel',
    departure: trip.departure,
    seats: 1,
    tripId: trip.id,
  };
  return {
    path,
    db,
    rider,
    other,
    driver,
    call,
    journey,
    login,
    book: (headers: Record<string, string>) => reserveTrip(app, headers, journey),
    restart: async () => {
      await app.close();
      app = buildApp({ databasePath: path, verifyIdentity });
    },
  };
}

test('separate passengers board and complete one departure with one append-only settlement each', async (t) => {
  const f = await fixture(t);
  const a = (await f.book(f.rider)).json(),
    b = (await f.book(f.other)).json();
  const action = (id: string, action: string, code?: string, key?: string) =>
    f.call(
      f.driver,
      '/driver/requests/' + id + '/action',
      { action, ...(code ? { code } : {}) },
      key,
    );
  assert.equal((await action(a.id, 'accept')).statusCode, 200);
  assert.equal(
    (await action(b.id, 'accept')).statusCode,
    200,
    'same-departure passengers can both be accepted',
  );
  const dashboard = (await f.call(f.driver, '/driver/dashboard')).json();
  assert.equal(dashboard.requests[0].departureId, dashboard.requests[1].departureId);
  assert.equal('code' in dashboard.requests[0], false);
  assert.equal((await action(a.id, 'start', a.code)).statusCode, 200);
  assert.equal((await f.call(f.rider, '/dashboard')).json().bookings[0].status, 'confirmed');
  assert.equal(
    (await f.call(f.rider, '/bookings/' + a.id + '/action', { action: 'cancel' })).statusCode,
    409,
  );
  assert.equal(
    (await f.book(await f.login('third'))).statusCode,
    409,
    'boarding closes new inventory',
  );
  assert.equal((await action(b.id, 'start', b.code)).statusCode, 200);
  for (const rider of [f.rider, f.other])
    assert.equal((await f.call(rider, '/dashboard')).json().bookings[0].status, 'in_progress');
  const key = randomUUID();
  assert.equal((await action(a.id, 'complete', undefined, key)).statusCode, 200);
  await f.restart();
  assert.equal(
    (await action(a.id, 'complete', undefined, key)).statusCode,
    200,
    'lost completion response can be replayed after restart',
  );
  assert.equal((await action(b.id, 'complete')).statusCode, 409);
  for (const rider of [f.rider, f.other])
    assert.equal((await f.call(rider, '/dashboard')).json().bookings[0].status, 'completed');
  assert.deepEqual((await f.call(f.driver, '/driver/dashboard')).json().earnings, {
    completed: 1,
    payout: 180,
    simulated: true,
  });
  assert.equal(f.db.prepare('SELECT COUNT(*) AS n FROM preview_settlements').get()!.n, 2);
  assert.throws(
    () => f.db.prepare('UPDATE preview_settlements SET payout_minor=0').run(),
    /append-only/,
  );
  assert.throws(() => f.db.prepare('DELETE FROM preview_settlements').run(), /append-only/);
});

test('an unresolved passenger blocks departure; cancellation releases the boarded passenger to start', async (t) => {
  const f = await fixture(t),
    a = (await f.book(f.rider)).json(),
    b = (await f.book(f.other)).json();
  const action = (id: string, action: string, code?: string) =>
    f.call(f.driver, '/driver/requests/' + id + '/action', { action, ...(code ? { code } : {}) });
  await action(a.id, 'accept');
  await action(a.id, 'start', a.code);
  const id = (await f.call(f.driver, '/driver/dashboard'))
    .json()
    .requests.find((r: { id: string }) => r.id === a.id).departureId;
  assert.equal((await f.call(f.driver, '/driver/departures/' + id + '/start', {})).statusCode, 409);
  assert.equal(
    (await f.call(f.other, '/bookings/' + b.id + '/action', { action: 'cancel' })).statusCode,
    200,
  );
  assert.equal((await f.call(f.driver, '/driver/departures/' + id + '/start', {})).statusCode, 200);
  assert.equal((await f.call(f.rider, '/dashboard')).json().bookings[0].status, 'in_progress');
});

test('boarding guesses are bounded across sessions and restarts without changing passenger state', async (t) => {
  const f = await fixture(t),
    booking = (await f.book(f.rider)).json();
  const url = '/driver/requests/' + booking.id + '/action';
  await f.call(f.driver, url, { action: 'accept' });
  for (let i = 0; i < 5; i++)
    assert.equal((await f.call(f.driver, url, { action: 'start', code: '0000' })).statusCode, 400);
  await f.restart();
  const driver = await f.login('driver');
  const response = await f.call(driver, url, { action: 'start', code: booking.code });
  assert.equal(response.statusCode, 429);
  assert.ok(Number(response.headers['retry-after']) > 0);
  assert.equal((await f.call(f.rider, '/dashboard')).json().bookings[0].status, 'confirmed');
  // Expire the durable windows to verify legitimate recovery; no wall-clock sleep.
  f.db.prepare('UPDATE rate_limits SET expires_at=0').run();
  assert.equal(
    (await f.call(driver, url, { action: 'start', code: booking.code })).statusCode,
    200,
  );
});

test('quotes are private, expire, reject tampering, and duplicate confirmations allocate once', async (t) => {
  const f = await fixture(t);
  assert.equal(
    (await f.call(f.rider, '/bookings', f.journey)).statusCode,
    400,
    'quote is mandatory',
  );
  const quote = (await f.call(f.rider, '/booking-quotes', f.journey)).json();
  assert.equal((await f.call(f.other, '/bookings', { quoteId: quote.quoteId })).statusCode, 404);
  assert.equal(
    (await f.call(f.rider, '/bookings', { quoteId: quote.quoteId, fare: 1 })).statusCode,
    400,
  );
  const key = randomUUID(),
    payload = { quoteId: quote.quoteId };
  const responses = await Promise.all([
    f.call(f.rider, '/bookings', payload, key),
    f.call(f.rider, '/bookings', payload, key),
  ]);
  assert.deepEqual(
    responses.map((r) => r.statusCode),
    [201, 201],
  );
  assert.equal(responses[0].json().id, responses[1].json().id);
  assert.equal(
    (await f.call(f.rider, '/bookings', payload)).json().id,
    responses[0].json().id,
    'quote cannot allocate a second reservation',
  );
  await f.restart();
  assert.equal(
    (await f.call(f.rider, '/bookings', payload, key)).json().id,
    responses[0].json().id,
  );
  assert.equal(
    (await f.call(f.rider, '/bookings', { quoteId: randomUUID() }, key)).statusCode,
    409,
  );
  assert.equal((await f.call(f.rider, '/dashboard')).json().bookings.length, 1);
  const expired = (await f.call(f.other, '/booking-quotes', f.journey)).json();
  f.db.prepare('UPDATE booking_quotes SET expires_at=0 WHERE id=?').run(expired.quoteId);
  assert.equal((await f.call(f.other, '/bookings', { quoteId: expired.quoteId })).statusCode, 409);
  assert.equal((await f.call(f.other, '/dashboard')).json().bookings.length, 0);
});

test('quotes lock the shown fare, recheck capacity and roll back consumption on allocation failure', async (t) => {
  const f = await fixture(t),
    quote = (await f.call(f.rider, '/booking-quotes', f.journey)).json();
  const full = (await f.call(f.other, '/booking-quotes', { ...f.journey, seats: 3 })).json();
  const booking = (await f.call(f.other, '/bookings', { quoteId: full.quoteId })).json();
  assert.equal((await f.call(f.rider, '/bookings', { quoteId: quote.quoteId })).statusCode, 409);
  assert.equal(
    f.db.prepare('SELECT booking_id FROM booking_quotes WHERE id=?').get(quote.quoteId)!.booking_id,
    null,
  );
  await f.call(f.other, '/bookings/' + booking.id + '/action', { action: 'cancel' });
  const confirmed = await f.call(f.rider, '/bookings', { quoteId: quote.quoteId });
  assert.equal(confirmed.statusCode, 201);
  assert.equal(confirmed.json().fare, quote.fare);
});

test('a WAL snapshot restores private reservations, sessions, retry receipts and settlement records', async (t) => {
  const f = await fixture(t);
  const quote = (await f.call(f.rider, '/booking-quotes', f.journey)).json(),
    key = randomUUID();
  const booking = (await f.call(f.rider, '/bookings', { quoteId: quote.quoteId }, key)).json();
  const url = '/driver/requests/' + booking.id + '/action';
  await f.call(f.driver, url, { action: 'accept' });
  await f.call(f.driver, url, { action: 'start', code: booking.code });
  await f.call(f.driver, url, { action: 'complete' });
  const snapshot = join(dirname(f.path), 'snapshot.sqlite'),
    restored = join(dirname(f.path), 'restored.sqlite');
  assert.equal(backupDatabase(f.path, snapshot).integrity, 'ok');
  assert.equal(statSync(snapshot).mode & 0o777, 0o600);
  assert.equal(restoreDatabase(snapshot, restored).integrity, 'ok');
  assert.throws(() => restoreDatabase(snapshot, restored), /never overwritten/);
  const app = buildApp({ databasePath: restored });
  try {
    const state = (await app.inject({ url: '/api/v1/dashboard', headers: f.rider })).json();
    assert.equal(state.bookings[0].id, booking.id);
    assert.equal(state.bookings[0].status, 'completed');
    const retry = await app.inject({
      url: '/api/v1/bookings',
      method: 'POST',
      headers: { ...f.rider, 'idempotency-key': key },
      payload: { quoteId: quote.quoteId },
    });
    assert.equal(retry.statusCode, 201);
    assert.equal(retry.json().id, booking.id);
    assert.equal(
      (await app.inject({ url: '/api/v1/driver/dashboard', headers: f.driver })).json().earnings
        .payout,
      90,
    );
    assert.equal(
      (await app.inject({ url: '/api/v1/dashboard', headers: f.other })).json().bookings.length,
      0,
    );
  } finally {
    await app.close();
  }
  appendFileSync(snapshot, 'corrupt');
  assert.throws(() => restoreDatabase(snapshot, join(dirname(f.path), 'bad.sqlite')), /checksum/);
});

test('a failure updating one passenger rolls back the entire shared completion and every settlement', async (t) => {
  const f = await fixture(t),
    a = (await f.book(f.rider)).json(),
    b = (await f.book(f.other)).json();
  const action = (id: string, action: string, code?: string) =>
    f.call(f.driver, '/driver/requests/' + id + '/action', { action, ...(code ? { code } : {}) });
  await action(a.id, 'accept');
  await action(b.id, 'accept');
  await action(a.id, 'start', a.code);
  await action(b.id, 'start', b.code);
  // Fail only the second passenger's completion, after the first has been written in the transaction.
  f.db.exec(`CREATE TRIGGER fail_completion BEFORE UPDATE ON workspaces
    WHEN json_extract(NEW.state,'$.bookings[0].status')='completed' AND
      EXISTS (SELECT 1 FROM accounts WHERE workspace_id=NEW.id AND id='other')
    BEGIN SELECT RAISE(ABORT,'Injected storage failure'); END`);
  assert.equal((await action(a.id, 'complete')).statusCode, 500);
  for (const rider of [f.rider, f.other])
    assert.equal((await f.call(rider, '/dashboard')).json().bookings[0].status, 'in_progress');
  assert.equal(f.db.prepare('SELECT COUNT(*) AS n FROM preview_settlements').get()!.n, 0);
  f.db.exec('DROP TRIGGER fail_completion');
  assert.equal((await action(a.id, 'complete')).statusCode, 200);
});

test('operator metrics exclude request values and session revocation removes only the selected account', async (t) => {
  const { spawnSync } = await import('node:child_process');
  const f = await fixture(t);
  await f.call(f.rider, '/dashboard?private-value=do-not-record');
  const routes = f.db.prepare('SELECT DISTINCT route FROM request_metrics').all();
  assert.ok(routes.some((row) => row.route === '/api/v1/dashboard'));
  assert.ok(
    routes.every(
      (row) =>
        !String(row.route).includes('private-value') &&
        !String(row.route).includes('do-not-record'),
    ),
  );
  const tool = new URL('../scripts/operations.mjs', import.meta.url);
  const run = (...args: string[]) =>
    spawnSync(process.execPath, [tool.pathname, ...args], {
      env: { ...process.env, DATABASE_PATH: f.path },
      encoding: 'utf8',
    });
  const revoked = run('revoke-sessions', 'rider');
  assert.equal(revoked.status, 0, revoked.stderr);
  assert.equal(JSON.parse(revoked.stdout).revoked, 1);
  assert.equal((await f.call(f.rider, '/dashboard')).statusCode, 401);
  assert.equal((await f.call(f.other, '/dashboard')).statusCode, 200);
  assert.equal(run('maintenance').status, 0);
  assert.equal(f.db.prepare('SELECT COUNT(*) AS n FROM operator_events').get()!.n, 2);
  const report = run('status');
  assert.equal(report.status, 0);
  assert.equal(report.stdout.includes(f.other.authorization), false);
});
