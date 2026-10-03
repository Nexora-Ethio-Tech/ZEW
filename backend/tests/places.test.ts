import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildApp } from '../src/app.js';
import { parsePlaces } from '../src/modules/groups/places.js';

test('arbitrary places persist, invalidate groups, preserve rules and complete into history', async (t) => {
  const app = buildApp();
  t.after(() => app.close());
  const token = (await app.inject({ method: 'POST', url: '/api/v1/session' })).json().token;
  const headers = { authorization: `Bearer ${token}` };
  const post = (path: string, payload?: object) =>
    app.inject({ method: 'POST', url: `/api/v1/pool${path}`, headers, payload });
  await post('/bootstrap');
  await post('/members', { action: 'add', riderId: 'sara' });
  const pickup = { name: 'Adama station', latitude: 8.54, longitude: 39.27 };
  const destination = { name: 'Adama university', latitude: 8.56, longitude: 39.29 };
  let pool = (await post('/place', { target: 'pickup', place: pickup })).json();
  assert.deepEqual(pool.mapPickup, pickup);
  assert.equal(pool.locationIssue, null);
  assert.deepEqual(pool.selectedIds, []);
  pool = (await post('/place', { target: 'destination', place: destination })).json();
  assert.deepEqual(pool.mapDestination, destination);
  assert.ok(pool.riders.every((r: { destination: string }) => r.destination === 'custom'));
  assert.deepEqual(
    (await app.inject({ url: '/api/v1/pool', headers })).json().mapDestination,
    destination,
  );
  assert.equal(
    (await post('/place', { target: 'pickup', place: { ...pickup, latitude: 91 } })).statusCode,
    400,
  );
  assert.equal(
    (await post('/place', { target: 'pickup', place: { ...pickup, fare: 1 } })).statusCode,
    400,
  );
  assert.equal((await post('/members', { action: 'add', riderId: 'nahom' })).statusCode, 409);
  pool = (await post('/members', { action: 'add', riderId: 'sara' })).json();
  assert.equal(pool.quote.yourFare, 180);
  assert.equal((await post('/request', { version: pool.version })).json().status, 'requested');
  assert.equal((await post('/place', { target: 'pickup', place: pickup })).statusCode, 409);
  await post('/accept', { groupId: pool.id, driverId: 'hana' });
  await post('/action', { action: 'start' });
  pool = (await post('/action', { action: 'complete' })).json();
  assert.equal(pool.history[0].route, 'Adama station → Adama university');
  await post('/action', { action: 'new' });
  pool = (await post('/destination', { destination: 'meskel' })).json();
  assert.equal(pool.destinationPlace, undefined);
  assert.equal(pool.riders[0].destination, 'meskel');
});

test('place search authenticates, validates, caches, throttles and handles provider failure', async (t) => {
  const app = buildApp();
  t.after(() => app.close());
  const fixture = {
    features: [
      {
        geometry: { coordinates: [39.27, 8.54] },
        properties: { name: 'Adama', city: 'Adama', country: 'Ethiopia' },
      },
    ],
  };
  let calls = 0;
  t.mock.method(globalThis, 'fetch', async () => {
    calls++;
    return new Response(JSON.stringify(fixture));
  });
  const token = (await app.inject({ method: 'POST', url: '/api/v1/session' })).json().token;
  const headers = { authorization: `Bearer ${token}` };
  const search = (query: string) =>
    app.inject({ method: 'POST', url: '/api/v1/places/search', headers, payload: { query } });
  assert.equal(
    (
      await app.inject({
        method: 'POST',
        url: '/api/v1/places/search',
        payload: { query: 'Adama' },
      })
    ).statusCode,
    401,
  );
  assert.equal((await search('a')).statusCode, 400);
  assert.deepEqual((await search('Adama')).json().places, [
    { name: 'Adama, Ethiopia', longitude: 39.27, latitude: 8.54 },
  ]);
  assert.equal((await search('ADAMA')).statusCode, 200);
  assert.equal(calls, 1);
  assert.equal((await search('Bishoftu')).statusCode, 429);
  assert.throws(() =>
    parsePlaces({ features: [{ geometry: { coordinates: [999, 90] }, properties: {} }] }),
  );
  const other = buildApp();
  t.after(() => other.close());
  const otherToken = (await other.inject({ method: 'POST', url: '/api/v1/session' })).json().token;
  t.mock.method(globalThis, 'fetch', async () => {
    throw new Error('offline');
  });
  assert.equal(
    (
      await other.inject({
        method: 'POST',
        url: '/api/v1/places/search',
        headers: { authorization: `Bearer ${otherToken}` },
        payload: { query: 'Adama' },
      })
    ).statusCode,
    503,
  );
});
