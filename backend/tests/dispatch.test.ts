import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { reserveTrip } from './helpers.js';
import { buildApp } from '../src/app.js';
import type { IdentityVerifier } from '../src/modules/auth/service.js';

const verifyIdentity: IdentityVerifier = async (token) => ({
  id: token,
  email: token.startsWith('driver') ? 'nexoratechnologyplc@gmail.com' : token + '@example.com',
  name: token === 'driver' ? 'Nexora' : 'Test passenger',
  emailConfirmed: token !== 'driver-unconfirmed',
});
async function setup() {
  const app = buildApp({ verifyIdentity });
  const login = async (identity: string) => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/session',
      headers: { authorization: 'Bearer ' + identity },
    });
    assert.equal(response.statusCode, 201);
    return { authorization: 'Bearer ' + response.json().token };
  };
  const rider = await login('rider'),
    driver = await login('driver');
  const call = (headers: Record<string, string>, path: string, payload?: object) =>
    path === '/bookings'
      ? reserveTrip(app, headers, payload!)
      : app.inject({ method: payload ? 'POST' : 'GET', url: '/api/v1' + path, headers, payload });
  return { app, login, rider, driver, call };
}
test('verified driver receives passenger circle, verifies boarding, completes once, and survives new sessions', async (t) => {
  const { app, login, rider, driver, call } = await setup();
  t.after(() => app.close());
  const draft = (await call(rider, '/pool/bootstrap', {})).json();
  const applied = await call(rider, '/pool/apply', { version: draft.version });
  assert.equal(applied.statusCode, 200);
  const group = applied.json();
  assert.equal(group.assignedDriver.name, 'Nexora');
  assert.equal(group.boardingCode, undefined);
  const dashboard = (await call(driver, '/driver/dashboard')).json();
  assert.equal(dashboard.requests.length, 1);
  assert.equal(dashboard.requests[0].id, group.id);
  assert.equal('code' in dashboard.requests[0], false);
  assert.equal('workspace_id' in dashboard.requests[0], false);
  const action = (action: string, code?: string) =>
    call(driver, '/driver/requests/' + group.id + '/action', { action, ...(code ? { code } : {}) });
  assert.equal((await action('accept')).statusCode, 200);
  assert.equal((await action('accept')).statusCode, 409);
  const accepted = (await call(rider, '/pool')).json();
  assert.equal(accepted.status, 'accepted');
  assert.match(accepted.boardingCode, /^\d{4}$/);
  assert.equal((await action('start', '0000')).statusCode, 400);
  assert.equal((await action('start', accepted.boardingCode)).statusCode, 200);
  assert.equal((await call(rider, '/pool')).json().status, 'in_progress');
  assert.equal((await action('complete')).statusCode, 200);
  assert.equal((await action('complete')).statusCode, 409);
  const completed = (await call(rider, '/pool')).json();
  assert.equal(completed.history[0].id, group.id);
  assert.equal(completed.status, 'completed');
  const freshRider = await login('rider');
  assert.equal((await call(freshRider, '/pool')).json().history[0].id, group.id);
  const freshDriver = await login('driver');
  assert.equal((await call(freshDriver, '/driver/dashboard')).json().earnings.completed, 1);
  assert.equal((await call(freshDriver, '/driver/dashboard')).json().earnings.payout, 324);
});

test('driver roles cannot be self-selected; passenger data and unassigned requests stay private', async (t) => {
  const { app, login, rider, driver, call } = await setup();
  t.after(() => app.close());
  const unconfirmed = await app.inject({
    method: 'POST',
    url: '/api/v1/auth/session',
    headers: { authorization: 'Bearer driver-unconfirmed' },
  });
  assert.equal(unconfirmed.statusCode, 403);
  // A different provider identity cannot take over an invitation already bound to an identity.
  const impersonator = await login('driver-other-id');
  assert.equal((await call(impersonator, '/auth/me')).json().user.role, 'rider');
  assert.equal((await call(rider, '/driver/dashboard')).statusCode, 403);
  assert.equal((await call(driver, '/pool/bootstrap', {})).statusCode, 403);
  assert.equal((await call(driver, '/dashboard')).statusCode, 403);
  const draft = (await call(rider, '/pool/bootstrap', {})).json();
  await call(rider, '/pool/apply', { version: draft.version });
  assert.equal(
    (await call(rider, '/driver/requests/' + draft.id + '/action', { action: 'accept' }))
      .statusCode,
    403,
  );
  assert.equal(
    (
      await call(driver, '/driver/requests/' + draft.id + '/action', {
        action: 'accept',
        sessionId: 'forged',
      })
    ).statusCode,
    400,
  );
  assert.equal(
    (
      await call(driver, '/driver/requests/00000000-0000-4000-8000-000000000000/action', {
        action: 'accept',
      })
    ).statusCode,
    404,
  );
  const other = await login('other-rider');
  const otherPool = (await call(other, '/pool/bootstrap', {})).json();
  assert.notEqual(otherPool.id, draft.id);
  assert.equal(otherPool.status, 'draft');
  assert.equal((await call(rider, '/pool/accept', { groupId: draft.id })).statusCode, 403);
});

test('planned requests share seat inventory across accounts and complete through the assigned driver', async (t) => {
  const { app, login, rider, driver, call } = await setup();
  t.after(() => app.close());
  const other = await login('other-rider');
  const trips = (await call(rider, '/dashboard')).json().trips;
  const trip = trips.find((trip: { id: string }) => trip.id === 'sample-hana');
  const journey = {
    corridorId: trip.corridorId,
    origin: 'bole',
    destination: 'meskel',
    departure: trip.departure,
    seats: 2,
    tripId: trip.id,
  };
  const first = await call(rider, '/bookings', journey);
  assert.equal(first.statusCode, 201);
  const booking = first.json();
  assert.equal(booking.driver, 'Nexora');
  const second = await call(other, '/bookings', journey);
  assert.equal(second.statusCode, 409);
  assert.equal(
    (await call(other, '/dashboard')).json().bookings.length,
    0,
    'failed shared capacity check rolls back the booking',
  );
  const matches = (
    await call(other, '/matches', {
      corridorId: journey.corridorId,
      origin: journey.origin,
      destination: journey.destination,
      departure: journey.departure,
      seats: 2,
    })
  ).json();
  assert.ok(!matches.matches.some((trip: { id: string }) => trip.id === journey.tripId));
  const action = (action: string, code?: string) =>
    call(driver, '/driver/requests/' + booking.id + '/action', {
      action,
      ...(code ? { code } : {}),
    });
  assert.equal((await action('start', booking.code)).statusCode, 409);
  assert.equal((await action('accept')).statusCode, 200);
  assert.equal((await call(rider, '/dashboard')).json().bookings[0].driverAccepted, true);
  assert.equal((await action('start', booking.code)).statusCode, 200);
  assert.equal((await action('complete')).statusCode, 200);
  assert.equal((await call(rider, '/dashboard')).json().bookings[0].status, 'completed');
  assert.equal((await call(driver, '/driver/dashboard')).json().earnings.payout, 180);
});

test('driver grants are checked on every request and unassigned drivers cannot act', async (t) => {
  const folder = mkdtempSync(join(tmpdir(), 'zew-driver-'));
  const path = join(folder, 'db.sqlite');
  const app = buildApp({ databasePath: path, verifyIdentity });
  t.after(async () => {
    await app.close();
    rmSync(folder, { recursive: true, force: true });
  });
  const db = new DatabaseSync(path);
  db.prepare('INSERT INTO driver_access VALUES (?, ?, ?, ?, ?, ?, ?)').run(
    'second-driver',
    'second@example.com',
    'second',
    'Second',
    'Test vehicle',
    4,
    1,
  );
  const headers = async (id: string) => ({
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
  const driver = await headers('driver'),
    second = await headers('second'),
    rider = await headers('rider');
  const draft = (
    await app.inject({ method: 'POST', url: '/api/v1/pool/bootstrap', headers: rider })
  ).json();
  await app.inject({
    method: 'POST',
    url: '/api/v1/pool/apply',
    headers: rider,
    payload: { version: draft.version },
  });
  assert.equal(
    (await app.inject({ url: '/api/v1/driver/dashboard', headers: second })).json().requests.length,
    0,
  );
  assert.equal(
    (
      await app.inject({
        method: 'POST',
        url: '/api/v1/driver/requests/' + draft.id + '/action',
        headers: second,
        payload: { action: 'accept' },
      })
    ).statusCode,
    404,
  );
  db.prepare('UPDATE driver_access SET active = 0 WHERE user_id = ?').run('driver');
  assert.equal(
    (await app.inject({ url: '/api/v1/driver/dashboard', headers: driver })).statusCode,
    403,
  );
  db.close();
});

test('concurrent accept attempts allow one active ride and passenger cancellation releases it', async (t) => {
  const { app, login, rider, driver, call } = await setup();
  t.after(() => app.close());
  const other = await login('other-rider');
  const create = async (headers: Record<string, string>) => {
    const draft = (await call(headers, '/pool/bootstrap', {})).json();
    return (await call(headers, '/pool/apply', { version: draft.version })).json();
  };
  const first = await create(rider),
    second = await create(other);
  const accept = (id: string) =>
    call(driver, '/driver/requests/' + id + '/action', { action: 'accept' });
  const responses = await Promise.all([accept(first.id), accept(second.id)]);
  assert.deepEqual(responses.map((r) => r.statusCode).sort(), [200, 409]);
  const winner = responses[0].statusCode === 200 ? rider : other;
  const waiting = responses[0].statusCode === 200 ? second : first;
  assert.equal((await call(winner, '/pool/action', { action: 'cancel' })).statusCode, 200);
  assert.equal((await accept(waiting.id)).statusCode, 200);
});

test('verified account data and driver assignments survive logout and API restart', async () => {
  const folder = mkdtempSync(join(tmpdir(), 'zew-account-restart-'));
  const path = join(folder, 'db.sqlite');
  let app = buildApp({ databasePath: path, verifyIdentity });
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
  try {
    const rider = await login('rider');
    const draft = (
      await app.inject({ method: 'POST', url: '/api/v1/pool/bootstrap', headers: rider })
    ).json();
    await app.inject({
      method: 'POST',
      url: '/api/v1/pool/apply',
      headers: rider,
      payload: { version: draft.version },
    });
    await app.inject({ method: 'POST', url: '/api/v1/auth/logout', headers: rider });
    assert.equal((await app.inject({ url: '/api/v1/pool', headers: rider })).statusCode, 401);
    await app.close();
    app = buildApp({ databasePath: path, verifyIdentity });
    const restored = await login('rider');
    assert.equal(
      (await app.inject({ url: '/api/v1/pool', headers: restored })).json().id,
      draft.id,
    );
    const driver = await login('driver');
    assert.equal(
      (await app.inject({ url: '/api/v1/driver/dashboard', headers: driver })).json().requests[0]
        .id,
      draft.id,
    );
  } finally {
    await app.close();
    rmSync(folder, { recursive: true, force: true });
  }
});
