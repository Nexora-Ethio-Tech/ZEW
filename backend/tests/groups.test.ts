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
  setTargetPreference,
  poolView,
  applyForGroup,
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
  pool.riders[2].readyUntil = now + 84000;
  assert.equal(driverIssue(pool, 'hana', now), 'Rider availability ends before pickup');
  const location = { latitude: 8.9982, longitude: 38.7865, accuracy: 20, timestamp: now };
  setDeviceLocation(pool, location, now);
  assert.equal(pool.zoneId, 'edna');
  assert.throws(
    () => setDeviceLocation(pool, { ...location, timestamp: now - 121000 }, now),
    /stale/,
  );
  assert.throws(() => setDeviceLocation(pool, { ...location, latitude: 0, longitude: 0 }, now), /Ethiopia/);
  assert.equal(pool.pickupPlace?.latitude, location.latitude);
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

test('application forms and locks a group without client-selected passengers or fare', async (t) => {
  const { app, request } = await setup();
  t.after(() => app.close());
  const initial = (await request('', undefined, 'GET')).json();
  assert.equal(initial.quote.count, 1);
  assert.equal(initial.demandZones.length, 17);
  assert.ok(initial.demandZones.reduce((total: number, zone: { pickupCount: number }) => total + zone.pickupCount, 0) >= 100);
  assert.ok(initial.demandZones.reduce((total: number, zone: { destinationCount: number }) => total + zone.destinationCount, 0) >= 90);
  assert.ok(initial.demandZones.every((zone: { pickupCount: number; destinationCount: number }) => zone.pickupCount > 0 && zone.destinationCount > 0));
  assert.equal((await request('/apply', { version: initial.version, riderIds: ['nahom'] })).statusCode, 400);
  assert.equal((await request('/apply', { version: initial.version, fare: 1 })).statusCode, 400);
  const refreshed = (await request('/refresh')).json();
  assert.equal((await request('/apply', { version: initial.version })).statusCode, 409);
  const applied = (await request('/apply', { version: refreshed.version })).json();
  assert.equal(applied.status, 'requested');
  assert.equal(applied.quote.count, 4);
  assert.equal(applied.lockedFare, 90);
  assert.deepEqual(applied.selectedIds, ['sara', 'bereket', 'eden']);
  assert.equal((await request('/apply', { version: applied.version })).statusCode, 409);
});

test('group size and fare limits control automatic matching without selecting riders', async (t) => {
  const { app, request } = await setup();
  t.after(() => app.close());
  const initial = (await request('', undefined, 'GET')).json();
  assert.equal((await request('/criteria', { version: initial.version, minSeats: 4, maxSeats: 2, maxFare: 120 })).statusCode, 400);
  assert.equal((await request('/criteria', { version: initial.version, minSeats: 2, maxSeats: 3, maxFare: 120, fare: 1 })).statusCode, 400);
  const criteria = (await request('/criteria', {
    version: initial.version,
    minSeats: 2,
    maxSeats: 3,
    maxFare: 120,
  })).json();
  assert.equal(criteria.minSeats, 2);
  assert.equal(criteria.maxSeats, 3);
  assert.equal(criteria.maxFare, 120);
  assert.equal((await request('/criteria', { version: initial.version, minSeats: 1, maxSeats: 4, maxFare: 360 })).statusCode, 409);
  const applied = (await request('/apply', { version: criteria.version })).json();
  assert.equal(applied.status, 'requested');
  assert.equal(applied.quote.count, 3);
  assert.equal(applied.lockedFare, 120);
  assert.deepEqual(applied.selectedIds, ['sara', 'bereket']);
});

test('application leaves a draft unchanged when no group meets its limits', async (t) => {
  const { app, request } = await setup();
  t.after(() => app.close());
  const initial = (await request('', undefined, 'GET')).json();
  const criteria = (await request('/criteria', {
    version: initial.version,
    minSeats: 2,
    maxSeats: 2,
    maxFare: 120,
  })).json();
  assert.equal((await request('/apply', { version: criteria.version })).statusCode, 409);
  const unchanged = (await request('', undefined, 'GET')).json();
  assert.equal(unchanged.status, 'draft');
  assert.equal(unchanged.version, criteria.version);
  assert.deepEqual(unchanged.selectedIds, []);
});

test('arbitrary group maximum and fare ceiling remain preferences while matching respects vehicle seats', async (t) => {
  const { app, request } = await setup();
  t.after(() => app.close());
  const initial = (await request('', undefined, 'GET')).json();
  const appliedResponse = await request('/apply', {
    version: initial.version, minSeats: 2, maxSeats: 1000000, maxFare: 125.75,
  });
  assert.equal(appliedResponse.statusCode, 200);
  const applied = appliedResponse.json();
  assert.equal(applied.maxSeats, 1000000);
  assert.equal(applied.maxFare, 125.75);
  assert.equal(applied.quote.count, 4);
  assert.equal(applied.lockedFare, 90);

  await request('/action', { action: 'cancel' });
  const second = (await request('/action', { action: 'new' })).json();
  assert.equal((await request('/apply', {
    version: second.version, minSeats: 5, maxSeats: 1000000, maxFare: 1000000,
  })).statusCode, 409);
  const unchanged = (await request('', undefined, 'GET')).json();
  assert.equal(unchanged.status, 'draft');
  assert.equal(unchanged.version, second.version);
});

test('application falls back to a solo demo when sample riders are unavailable', () => {
  const now = Date.now();
  const pool = seedPool(now);
  pool.riders.forEach((rider) => { rider.optedIn = false; });
  applyForGroup(pool, pool.version, now);
  assert.equal(pool.status, 'requested');
  assert.deepEqual(pool.selectedIds, []);
  assert.equal(pool.lockedFare, 360);
});

test('application does not match Bole sample riders to an Adama journey', () => {
  const now = Date.now();
  const pool = seedPool(now);
  pool.pickupPlace = { name: 'Adama station', latitude: 8.54, longitude: 39.27 };
  pool.destinationPlace = { name: 'Adama university', latitude: 8.56, longitude: 39.29 };
  pool.destination = 'custom';
  assert.match(poolView(pool, now).fareOptions[1].issue!, /Bole demo landmarks/);
  applyForGroup(pool, pool.version, now);
  assert.deepEqual(pool.selectedIds, []);
  assert.equal(pool.lockedFare, 360);
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

test('fare options agree with selected groups and unavailable preferences preserve membership', () => {
  const now = Date.now(),
    pool = seedPool(now);
  assert.deepEqual(
    poolView(pool, now).fareOptions.map((option) => option.yourFare),
    [360, 180, 120, 90],
  );
  setTargetPreference(pool, 4, now);
  assert.deepEqual(pool.selectedIds, ['sara', 'bereket', 'eden']);
  assert.equal(fareQuote(pool).yourFare, poolView(pool, now).fareOptions[3].yourFare);
  pool.skippedIds = pool.riders.filter((r) => r.id !== 'eden').map((r) => r.id);
  const before = structuredClone(pool);
  assert.throws(() => setTargetPreference(pool, 4, now), /Not enough ready/);
  assert.deepEqual(pool, before, 'A rejected preference must not replace the current group');
  assert.match(poolView(pool, now).fareOptions[3].issue!, /Not enough ready/);
  assert.throws(() => setTargetPreference(pool, 2.5, now), /Target seats/);
});

test('auto-fill checks driver arrival and readiness; expired riders cannot be selected', () => {
  const now = Date.now(),
    pool = seedPool(now);
  pool.riders[0].readyUntil = now + 50000; // Hana needs 55 seconds to reach Sara.
  setTargetPreference(pool, 2, now);
  assert.deepEqual(pool.selectedIds, ['bereket']);
  assert.throws(() => setTargetPreference(pool, 2, now + 121000), /Not enough ready/);
  setTargetPreference(pool, 1, now + 121000);
  assert.equal(fareQuote(pool).count, 1);
});

test('API preferences reject tampering and return authoritative destination fares', async (t) => {
  const { app, request } = await setup();
  t.after(() => app.close());
  assert.equal((await request('/preference', { targetSeats: 2, fare: 1 })).statusCode, 400);
  assert.equal((await request('/preference', { targetSeats: 2.5 })).statusCode, 400);
  assert.equal((await request('/preference', { targetSeats: 5 })).statusCode, 400);
  await request('/destination', { destination: 'mexico' });
  const group = (await request('/preference', { targetSeats: 4 })).json();
  assert.equal(group.quote.yourFare, 105);
  assert.equal(group.fareOptions[3].yourFare, group.quote.yourFare);
  await request('/request', { version: group.version });
  assert.equal((await request('/preference', { targetSeats: 1 })).statusCode, 409);
});

test('completed circle receipts fund only their demo driver and duplicate completion cannot add earnings', async (t) => {
  const { app, request } = await setup();
  t.after(() => app.close());
  const initial = (await request('', undefined, 'GET')).json();
  assert.ok(
    initial.driverEarnings.every((entry: { payout: number }) => entry.payout === 0),
    'Seeded rider history is not driver income',
  );
  const group = (await request('/preference', { targetSeats: 3 })).json();
  await request('/request', { version: group.version });
  await request('/accept', { groupId: group.id, driverId: 'hana' });
  await request('/action', { action: 'start' });
  const results = await Promise.all([
    request('/action', { action: 'complete' }),
    request('/action', { action: 'complete' }),
  ]);
  assert.deepEqual(results.map((result) => result.statusCode).sort(), [200, 409]);
  const completed = (await request('', undefined, 'GET')).json();
  assert.equal(completed.history.length, 3);
  assert.equal(completed.history[0].total, 360);
  assert.equal(completed.history[0].fee, 36);
  assert.equal(completed.history[0].driverPayout, 324);
  assert.deepEqual(
    completed.driverEarnings.find((entry: { driverId: string }) => entry.driverId === 'hana'),
    { driverId: 'hana', completedTrips: 1, payout: 324 },
  );
  assert.equal(
    completed.driverEarnings.find((entry: { driverId: string }) => entry.driverId === 'dawit')
      .payout,
    0,
  );
  await request('/action', { action: 'new' });
  await request('/destination', { destination: 'mexico' });
  const later = (await request('', undefined, 'GET')).json();
  assert.equal(
    later.history[0].total,
    360,
    'Receipt amounts are immutable when the next destination changes',
  );
});
