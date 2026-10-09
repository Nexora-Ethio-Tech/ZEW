import { test, type TestContext } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { reserveTrip } from './helpers.js';
import { buildAccountApp as buildApp, passengerSession } from './helpers.js';

async function fixture(t: TestContext) {
  const directory = mkdtempSync(join(tmpdir(), 'zew-planned-'));
  const path = join(directory, 'db.sqlite');
  const app = buildApp({ databasePath: path });
  const db = new DatabaseSync(path);
  t.after(async () => {
    db.close();
    await app.close();
    rmSync(directory, { recursive: true, force: true });
  });
  const { token } = (await passengerSession(app)).json();
  const headers = { authorization: 'Bearer ' + token };
  const call = (path: string, payload?: object) =>
    path === '/bookings'
      ? reserveTrip(app, headers, payload!)
      : app.inject({ method: payload ? 'POST' : 'GET', url: '/api/v1' + path, headers, payload });
  const trip = (await call('/dashboard'))
    .json()
    .trips.find((trip: { id: string }) => trip.id === 'sample-hana');
  const journey = {
    corridorId: trip.corridorId,
    origin: 'bole',
    destination: 'meskel',
    departure: trip.departure,
    seats: 2,
  };
  return { app, db, call, journey, trip };
}
test('search and reservations respect the configured vehicle capacity, including disabled routing', async (t) => {
  const { db, call, journey, trip } = await fixture(t);
  db.prepare('UPDATE driver_access SET seats=1 WHERE id=?').run('nexora-test-driver');
  const matches = (await call('/matches', journey)).json();
  assert.equal(matches.matches.length, 0);
  assert.ok(
    matches.rejected.some(
      (r: { tripId: string; reason: string }) =>
        r.tripId === trip.id && r.reason === 'Not enough seats',
    ),
  );
  assert.equal(
    (await call('/dashboard')).json().trips.find((r: { id: string }) => r.id === trip.id)
      .availableSeats,
    1,
  );
  assert.equal((await call('/bookings', { ...journey, tripId: trip.id })).statusCode, 409);
  assert.equal((await call('/dashboard')).json().bookings.length, 0);
  db.prepare('UPDATE dispatch_settings SET test_driver_id=NULL WHERE id=1').run();
  assert.equal((await call('/matches', { ...journey, seats: 1 })).json().matches.length, 0);
});

test('passenger dashboard shares anonymous preview demand counts without rider details', async (t) => {
  const { call } = await fixture(t);
  const dashboard = (await call('/dashboard')).json();
  assert.ok(
    dashboard.previewDemand.some((point: { pickupCount: number }) => point.pickupCount > 0),
  );
  assert.ok(
    dashboard.previewDemand.some(
      (point: { destinationCount: number }) => point.destinationCount > 0,
    ),
  );
  assert.equal('riders' in dashboard, false);
  assert.equal('phone' in dashboard.previewDemand[0], false);
});

test('automatic group request assigns the cheapest eligible trip within the server-enforced fare cap', async (t) => {
  const { call, journey } = await fixture(t);
  const response = await call('/group-requests', { ...journey, seats: 1, maxFare: 200 });
  assert.equal(response.statusCode, 201);
  assert.ok(response.json().booking.id);
  assert.ok(response.json().assignedFarePerSeat <= 200);
  const dashboard = (await call('/dashboard')).json();
  assert.equal(dashboard.bookings.length, 1);
  assert.equal(dashboard.bookings[0].fare, response.json().assignedFarePerSeat);
  assert.equal(
    (await call('/group-requests', { ...journey, seats: 1, maxFare: 1 })).statusCode,
    409,
  );
});
test('cancellation can release a reservation after the vehicle capacity is reduced', async (t) => {
  const { db, call, journey, trip } = await fixture(t);
  const response = await call('/bookings', { ...journey, tripId: trip.id });
  assert.equal(response.statusCode, 201);
  db.prepare('UPDATE driver_access SET seats=1 WHERE id=?').run('nexora-test-driver');
  const cancelled = await call('/bookings/' + response.json().id + '/action', { action: 'cancel' });
  assert.equal(cancelled.statusCode, 200);
  assert.equal(cancelled.json().status, 'cancelled');
  assert.equal(
    (await call('/dashboard')).json().trips.find((r: { id: string }) => r.id === trip.id)
      .availableSeats,
    1,
  );
});
test('a journey cannot claim a corridor that does not contain its stops', async (t) => {
  const { call, journey } = await fixture(t);
  const dashboard = (await call('/dashboard')).json();
  const wrong = dashboard.corridors.find(
    (c: { id: string; stops: { id: string }[] }) => !c.stops.some((s) => s.id === journey.origin),
  );
  assert.ok(wrong);
  assert.equal((await call('/matches', { ...journey, corridorId: wrong.id })).statusCode, 400);
  assert.equal(
    (await call('/bookings', { ...journey, corridorId: wrong.id, tripId: 'sample-hana' }))
      .statusCode,
    400,
  );
});

test('future commutes use shared departure slots and past bookings do not block another day', async (t) => {
  const { app, call, journey } = await fixture(t);
  const tomorrow = Math.ceil((Date.now() + 2 * 86400000) / 900000) * 900000;
  const request = { ...journey, departure: new Date(tomorrow + 60000).toISOString() };
  const match = (await call('/matches', request))
    .json()
    .matches.find((trip: { id: string }) => trip.id === 'sample-hana');
  assert.ok(match);
  const booked = await call('/bookings', { ...request, tripId: match.id });
  assert.equal(booked.statusCode, 201);
  assert.equal(booked.json().departure, match.departure);
  assert.equal(booked.json().fare, match.totalFare);
  assert.equal((await call('/bookings', { ...request, tripId: match.id })).statusCode, 409);
  const token = (await passengerSession(app)).json().token;
  const other = await reserveTrip(
    app,
    { authorization: 'Bearer ' + token },
    { ...request, departure: new Date(tomorrow + 120000).toISOString(), tripId: match.id },
  );
  assert.equal(other.statusCode, 409, 'nearby requested times share the same departure inventory');
  const anotherDay = { ...request, departure: new Date(tomorrow + 86400000 + 60000).toISOString() };
  assert.equal((await call('/bookings', { ...anotherDay, tripId: match.id })).statusCode, 201);
  const bookings = (await call('/dashboard')).json().bookings;
  assert.equal(bookings.length, 2);
  assert.notEqual(bookings[0].departure, bookings[1].departure);
});
