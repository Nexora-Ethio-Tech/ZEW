import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildApp } from '../src/app.js';
import { seedPool } from '../src/modules/groups/model.js';
import {
  addRider,
  riderIssue,
  fareQuote,
  syncExpiry,
  requestGroup,
  acceptGroup,
  driverIssue,
  setDeviceLocation,
} from '../src/modules/groups/service.js';

test('group adds only same-direction riders within the full 120-second pickup span', () => {
  const now = Date.now(),
    pool = seedPool(now);
  addRider(pool, 'sara', now);
  addRider(pool, 'bereket', now);
  assert.equal(fareQuote(pool).yourFare, 120);
  assert.throws(() => addRider(pool, 'nahom', now), /More than 2 minutes/);
  assert.throws(() => addRider(pool, 'meron', now), /Other side/);
  assert.throws(() => addRider(pool, 'sara', now), /already/);
  const eden = pool.riders.find((r) => r.id === 'eden')!;
  eden.pickupSeconds = 120;
  assert.equal(riderIssue(pool, eden, now), null);
  eden.pickupSeconds = 121;
  assert.equal(riderIssue(pool, eden, now), 'More than 2 minutes away');
  pool.destination = 'wollosefer';
  assert.equal(riderIssue(pool, pool.riders[0], now), 'Drop-off is beyond your route');
});

test('fare is deterministic and expires old membership before confirming a stale quote', () => {
  const now = Date.now(),
    pool = seedPool(now);
  assert.equal(fareQuote(pool).yourFare, 360);
  addRider(pool, 'sara', now);
  assert.equal(fareQuote(pool).yourFare, 180);
  addRider(pool, 'bereket', now);
  assert.equal(fareQuote(pool).yourFare, 120);
  addRider(pool, 'eden', now);
  assert.equal(fareQuote(pool).yourFare, 90);
  const version = pool.version;
  pool.riders[0].readyUntil = now - 1;
  assert.throws(() => requestGroup(pool, version, now), /fare changed/);
  assert.deepEqual(pool.selectedIds, ['bereket', 'eden']);
  assert.equal(fareQuote(pool).yourFare, 120);
  syncExpiry(pool, now + 121000);
  assert.equal(pool.selectedIds.length, 0);
});

test('driver checks capacity and full pickup ETA; fare and membership lock at request', () => {
  const now = Date.now(),
    pool = seedPool(now);
  addRider(pool, 'sara', now);
  addRider(pool, 'bereket', now);
  addRider(pool, 'eden', now);
  pool.riders.find((r) => r.id === 'eden')!.pickupSeconds = 100;
  requestGroup(pool, pool.version, now);
  assert.equal(pool.lockedFare, 90);
  assert.throws(() => addRider(pool, 'nahom', now), /Cancel or finish/);
  assert.equal(driverIssue(pool, 'dawit', now), 'Not enough passenger seats');
  assert.equal(driverIssue(pool, 'abel', now), 'Last pickup would exceed 2 minutes');
  // Hana: 20 sec to you + 100 sec to the final pickup = exactly 120 sec.
  assert.equal(driverIssue(pool, 'hana', now), null);
  acceptGroup(pool, 'hana', now);
  assert.equal(pool.status, 'accepted');
  assert.throws(() => acceptGroup(pool, 'hana', now), /no longer open/);
  syncExpiry(pool, now + 121000);
  assert.equal(pool.status, 'expired');
});

test('expired ready windows and locations fail closed, including arrival before readiness ends', () => {
  const now = Date.now(),
    pool = seedPool(now);
  pool.riders[0].locationAt = now - 121000;
  assert.throws(() => addRider(pool, 'sara', now), /expired/);
  pool.riders[1].optedIn = false;
  assert.throws(() => addRider(pool, 'bereket', now), /No longer/);
  addRider(pool, 'eden', now);
  pool.riders[2].readyUntil = now + 99000;
  assert.equal(driverIssue(pool, 'hana', now), 'Rider availability ends before pickup');
  const location = { latitude: 8.9982, longitude: 38.7865, accuracy: 20, timestamp: now };
  setDeviceLocation(pool, location, now);
  assert.equal(pool.zoneId, 'edna');
  assert.throws(
    () => setDeviceLocation(pool, { ...location, timestamp: now - 121000 }, now),
    /stale/,
  );
  setDeviceLocation(pool, { ...location, latitude: 0, longitude: 0 }, now);
  assert.equal(pool.zoneId, null);
  assert.equal(pool.pickupPlace?.latitude, 0);
  assert.equal(pool.locationSource, 'device');
  setDeviceLocation(pool, { ...location, accuracy: 500 }, now);
  assert.throws(() => requestGroup(pool, pool.version, now), /approximate/);
});

async function setup() {
  const app = buildApp();
  const token = (await app.inject({ method: 'POST', url: '/api/v1/session' })).json().token;
  const headers = { authorization: `Bearer ${token}` };
  const request = (path: string, payload?: object, method: 'GET' | 'POST' = 'POST') =>
    app.inject({ method, url: `/api/v1/pool${path}`, headers, payload });
  await request('/bootstrap');
  return { app, request, headers };
}

test('API group lifecycle, tampering protection, duplicate acceptance and new-group history', async (t) => {
  const { app, request } = await setup();
  t.after(() => app.close());
  assert.equal((await request('/members', { riderId: 'nahom', action: 'add' })).statusCode, 409);
  assert.equal((await request('/members', { riderId: 'sara', action: 'add' })).statusCode, 200);
  const group = (await request('/members', { riderId: 'bereket', action: 'add' })).json();
  assert.equal(group.quote.yourFare, 120);
  assert.equal((await request('/request', { version: group.version, fare: 1 })).statusCode, 400);
  assert.equal((await request('/request', { version: group.version - 1 })).statusCode, 409);
  assert.equal((await request('/request', { version: group.version })).json().status, 'requested');
  assert.equal((await request('/members', { riderId: 'sara', action: 'remove' })).statusCode, 409);
  const results = await Promise.all([
    request('/accept', { groupId: group.id, driverId: 'hana' }),
    request('/accept', { groupId: group.id, driverId: 'hana' }),
  ]);
  assert.deepEqual(results.map((r) => r.statusCode).sort(), [200, 409]);
  assert.equal((await request('/action', { action: 'complete' })).statusCode, 409);
  assert.equal((await request('/action', { action: 'start' })).json().status, 'in_progress');
  const completed = (await request('/action', { action: 'complete' })).json();
  assert.equal(completed.history[0].fare, 120);
  assert.equal(completed.status, 'completed');
  const fresh = (await request('/action', { action: 'new' })).json();
  assert.notEqual(fresh.id, group.id);
  assert.equal(fresh.history.length, 3);
});

test('device coordinates are private, fallback clears them, and other sessions cannot accept a group', async (t) => {
  const { app, request } = await setup();
  t.after(() => app.close());
  const gps = await request('/location', {
    source: 'device',
    latitude: 8.9982,
    longitude: 38.7865,
    accuracy: 10,
    timestamp: Date.now(),
  });
  assert.equal(gps.statusCode, 200);
  assert.equal(gps.json().locationSource, 'device');
  assert.equal('latitude' in gps.json().location, false);
  assert.equal('longitude' in gps.json().location, false);
  assert.equal(gps.json().mapPickup.latitude, 8.9982);
  const demo = (await request('/location', { source: 'demo', zoneId: 'atlas' })).json();
  assert.equal(demo.location, undefined);
  await request('/request', { version: demo.version });
  const token = (await app.inject({ method: 'POST', url: '/api/v1/session' })).json().token;
  const headers = { authorization: `Bearer ${token}` };
  await app.inject({ method: 'POST', url: '/api/v1/pool/bootstrap', headers });
  const cross = await app.inject({
    method: 'POST',
    url: '/api/v1/pool/accept',
    headers,
    payload: { groupId: demo.id, driverId: 'hana' },
  });
  assert.equal(cross.statusCode, 409);
  const other = (await app.inject({ url: '/api/v1/pool', headers })).json();
  assert.equal(other.location, undefined);
  assert.equal((await app.inject({ url: '/api/v1/pool' })).statusCode, 401);
});
