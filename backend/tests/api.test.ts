import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { reserveTrip } from './helpers.js';
import { buildApp } from '../src/app.js';
import { findMatches } from '../src/modules/matching/service.js';
import { seedState } from '../src/modules/trips/model.js';

async function setup(databasePath = ':memory:') {
  const app = buildApp({ databasePath });
  const session = await app.inject({ method: 'POST', url: '/api/v1/session' });
  assert.equal(session.statusCode, 201);
  const headers = { authorization: `Bearer ${session.json().token}` };
  const dashboard = (await app.inject({ url: '/api/v1/dashboard', headers })).json();
  const journey = {
    corridorId: 'bole-centre',
    origin: 'bole',
    destination: 'meskel',
    departure: dashboard.trips[0].departure,
    seats: 1,
  };
  const request = (url: string, payload?: unknown, method: 'POST' | 'GET' | 'DELETE' = 'POST') =>
    url === '/bookings'
      ? reserveTrip(app, headers, payload as object)
      : app.inject({ url: `/api/v1${url}`, method, headers, payload: payload as object });
  return { app, headers, journey, request };
}

test('matching checks direction, containment, time and capacity; ranks closest departure first', () => {
  const state = seedState();
  const journey = {
    corridorId: 'bole-centre',
    origin: 'bole',
    destination: 'meskel',
    departure: state.trips[0].departure,
    seats: 1,
  };
  assert.deepEqual(
    findMatches(state, journey).matches.map((t) => t.id),
    ['sample-hana', 'sample-dawit'],
  );
  assert.equal(
    findMatches(state, { ...journey, origin: 'meskel', destination: 'bole' }).matches.length,
    0,
  );
  assert.deepEqual(
    findMatches(state, { ...journey, destination: 'mexico' }).matches.map((t) => t.id),
    ['sample-hana'],
  );
  assert.equal(findMatches(state, { ...journey, seats: 4 }).matches.length, 0);
  assert.equal(
    findMatches(state, {
      ...journey,
      departure: new Date(Date.parse(journey.departure) + 3600000).toISOString(),
    }).matches.length,
    0,
  );
  state.trips[0].origin = 'mexico';
  state.trips[0].destination = 'bole';
  assert.equal(
    findMatches(state, { ...journey, origin: 'meskel', destination: 'atlas' }).matches[0].id,
    'sample-hana',
  );
});

test('rider can reserve and cancel, but cannot board or complete a booking', async (t) => {
  const { app, journey, request } = await setup();
  t.after(() => app.close());
  const book = () => request('/bookings', { ...journey, tripId: 'sample-hana' });
  const results = await Promise.all([book(), book()]);
  assert.deepEqual(results.map((r) => r.statusCode).sort(), [201, 409]);
  const booking = results.find((r) => r.statusCode === 201)!.json();
  const dash = (await request('/dashboard', undefined, 'GET')).json();
  assert.equal(dash.trips.find((t: { id: string }) => t.id === 'sample-hana').availableSeats, 2);
  assert.equal(
    (await request(`/bookings/${booking.id}/action`, { action: 'complete' })).statusCode,
    403,
  );
  assert.equal(
    (await request(`/bookings/${booking.id}/action`, { action: 'board', code: '0000' })).statusCode,
    403,
  );
  assert.equal(
    (await request(`/bookings/${booking.id}/action`, { action: 'board', code: booking.code }))
      .statusCode,
    403,
  );
  assert.equal(
    (await request(`/bookings/${booking.id}/action`, { action: 'cancel' })).statusCode,
    200,
  );
  const after = (await request('/dashboard', undefined, 'GET')).json();
  assert.equal(after.bookings[0].status, 'cancelled');
  assert.equal(
    (await request(`/bookings/${booking.id}/action`, { action: 'complete' })).statusCode,
    403,
  );
});

test('planned fare is server calculated and passenger actions cannot create earnings', async (t) => {
  const { app, journey, request } = await setup();
  t.after(() => app.close());
  const selected = { ...journey, seats: 2 };
  const matches = (await request('/matches', selected)).json();
  const match = matches.matches.find((trip: { id: string }) => trip.id === 'sample-hana');
  const booking = (await request('/bookings', { ...selected, tripId: match.id })).json();
  assert.equal(booking.fare, match.totalFare);
  const before = (await request('/dashboard', undefined, 'GET')).json();
  assert.equal(before.demoEarnings.driverPayout, 0);
  assert.equal(
    (await request(`/bookings/${booking.id}/action`, { action: 'board', code: booking.code }))
      .statusCode,
    403,
  );
  assert.equal(
    (await request(`/bookings/${booking.id}/action`, { action: 'complete' })).statusCode,
    403,
  );
  const after = (await request('/dashboard', undefined, 'GET')).json();
  assert.equal(after.demoEarnings.completedTrips, 0);
  assert.equal(after.demoEarnings.totalFare, 0);
});

test('cancellation releases seats and another browser cannot read or mutate a booking', async (t) => {
  const { app, journey, request } = await setup();
  t.after(() => app.close());
  const booking = (
    await request('/bookings', { ...journey, seats: 3, tripId: 'sample-hana' })
  ).json();
  const other = (await app.inject({ method: 'POST', url: '/api/v1/session' })).json();
  const otherHeaders = { authorization: `Bearer ${other.token}` };
  assert.deepEqual(
    (await app.inject({ url: '/api/v1/dashboard', headers: otherHeaders })).json().bookings,
    [],
  );
  assert.equal(
    (
      await app.inject({
        method: 'POST',
        url: `/api/v1/bookings/${booking.id}/action`,
        headers: otherHeaders,
        payload: { action: 'cancel' },
      })
    ).statusCode,
    404,
  );
  assert.equal((await app.inject({ url: '/api/v1/dashboard' })).statusCode, 401);
  assert.equal(
    (await request(`/bookings/${booking.id}/action`, { action: 'cancel' })).json().status,
    'cancelled',
  );
  const dash = (await request('/dashboard', undefined, 'GET')).json();
  assert.equal(dash.trips.find((t: { id: string }) => t.id === 'sample-hana').availableSeats, 3);
  assert.equal(
    (await request('/bookings', { ...journey, seats: 3, tripId: 'sample-hana' })).statusCode,
    201,
  );
});

test('reject malformed journeys, fare tampering and unconsented registration', async (t) => {
  const { app, journey, request } = await setup();
  t.after(() => app.close());
  for (const override of [
    { seats: -1 },
    { seats: 1.5 },
    { origin: 'unknown' },
    { destination: 'bole' },
    { departure: '2020-01-01T08:00:00Z' },
    { corridorId: 'not-real' },
  ]) {
    assert.equal((await request('/matches', { ...journey, ...override })).statusCode, 400);
  }
  assert.equal(
    (await request('/bookings', { ...journey, tripId: 'sample-hana', fare: 1 })).statusCode,
    400,
  );
  assert.equal(
    (
      await request('/waitlist', {
        name: 'Demo User',
        email: 'demo@example.com',
        role: 'rider',
        consent: false,
      })
    ).statusCode,
    400,
  );
  assert.equal(
    (
      await request('/waitlist', {
        name: 'Demo User',
        email: 'demo@example.com',
        role: 'rider',
        consent: true,
      })
    ).statusCode,
    200,
  );
  const dash = (await request('/dashboard', undefined, 'GET')).json();
  assert.equal(dash.waitlistJoined, true);
  assert.equal('waitlist' in dash, false);
});

test('rider can save commutes but cannot offer or cancel driver trips', async (t) => {
  const { app, journey, request } = await setup();
  t.after(() => app.close());
  const saved = await request('/commutes', { ...journey, name: 'Work' });
  assert.equal(saved.statusCode, 201);
  assert.equal(
    (await request(`/commutes/${saved.json().id}`, undefined, 'DELETE')).statusCode,
    200,
  );
  assert.equal(
    (await request('/trips', { ...journey, driver: 'Demo Driver', vehicle: 'Toyota Vitz' }))
      .statusCode,
    403,
  );
  assert.equal((await request('/trips/sample-hana/cancel', {})).statusCode, 403);
});

test('state survives API restart and bearer tokens remain valid', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'zew-test-'));
  const path = join(directory, 'test.sqlite');
  let app: ReturnType<typeof buildApp> | undefined;
  try {
    const first = await setup(path);
    app = first.app;
    await first.request('/commutes', { ...first.journey, name: 'Persistent commute' });
    await app.close();
    app = buildApp({ databasePath: path });
    const result = await app.inject({ url: '/api/v1/dashboard', headers: first.headers });
    assert.equal(result.statusCode, 200);
    assert.equal(result.json().commutes[0].name, 'Persistent commute');
    assert.equal(result.json().events[0].kind, 'commute.saved');
  } finally {
    await app?.close();
    rmSync(directory, { recursive: true, force: true });
  }
});
