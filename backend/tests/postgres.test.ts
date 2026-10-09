import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { buildApp } from '../src/app.js';
import { PostgresStore } from '../src/shared/postgres-store.js';
const url = process.env.ZEW_POSTGRES_TEST_URL,
  schema = process.env.ZEW_POSTGRES_TEST_SCHEMA;

test(
  'Postgres persists private accounts, shared inventory, idempotency and boarding across independent API instances',
  { skip: !url || !schema },
  async (t) => {
    const first = new PostgresStore(url!, schema),
      second = new PostgresStore(url!, schema);
    const identity = async (id: string) => ({
      id,
      email: id === 'driver' ? 'nexoratechnologyplc@gmail.com' : id + '@example.com',
      name: id,
      emailConfirmed: true,
    });
    const a = buildApp({ store: first, verifyIdentity: identity }),
      b = buildApp({ store: second, verifyIdentity: identity });
    t.after(async () => {
      await a.close();
      await b.close();
    });
    const login = async (id: string) => ({
      authorization:
        'Bearer ' +
        (
          await a.inject({
            method: 'POST',
            url: '/api/v1/auth/session',
            headers: { authorization: 'Bearer ' + id },
          })
        ).json().token,
    });
    const rider = await login('rider'),
      other = await login('other'),
      third = await login('third'),
      driver = await login('driver');
    const call = (
      app: typeof a,
      headers: Record<string, string>,
      path: string,
      payload?: object,
      key?: string,
    ) =>
      app.inject({
        method: payload ? 'POST' : 'GET',
        url: '/api/v1' + path,
        headers: { ...headers, ...(key ? { 'idempotency-key': key } : {}) },
        payload,
      });
    assert.equal((await call(b, rider, '/auth/me')).json().user.id, 'rider');
    assert.equal((await call(b, rider, '/driver/dashboard')).statusCode, 403);
    const dashboard = await call(a, rider, '/dashboard');
    assert.equal(dashboard.statusCode, 200, dashboard.body);
    const trip = dashboard.json().trips.find((trip: { id: string }) => trip.id === 'sample-hana');
    const journey = {
      corridorId: trip.corridorId,
      origin: 'bole',
      destination: 'meskel',
      departure: trip.departure,
      seats: 2,
      tripId: trip.id,
    };
    const quote = async (headers: Record<string, string>, seats: number) => {
      const response = await call(a, headers, '/booking-quotes', { ...journey, seats });
      assert.equal(response.statusCode, 201, response.body);
      return { quoteId: response.json().quoteId };
    };
    const q1 = await quote(rider, 2),
      q2 = await quote(other, 2);
    assert.equal((await call(b, third, '/bookings', q1)).statusCode, 404);
    const key = randomUUID();
    const competing = await Promise.all([
      call(a, rider, '/bookings', q1, key),
      call(b, other, '/bookings', q2),
    ]);
    assert.deepEqual(
      competing.map((r) => r.statusCode).sort(),
      [201, 409],
      competing.map((r) => r.body).join('\n'),
    );
    const winning = competing[0].statusCode === 201 ? rider : other,
      losing = competing[0].statusCode === 201 ? other : rider;
    const booked = competing.find((r) => r.statusCode === 201)!.json();
    if (winning === rider)
      assert.equal((await call(b, rider, '/bookings', q1, key)).json().id, booked.id);
    const secondQuote = await quote(losing, 1);
    const secondBooking = (await call(b, losing, '/bookings', secondQuote)).json();
    assert.ok(secondBooking.id);
    const action = (id: string, action: string, code?: string, k?: string) =>
      call(
        b,
        driver,
        '/driver/requests/' + id + '/action',
        { action, ...(code ? { code } : {}) },
        k,
      );
    for (const booking of [booked, secondBooking])
      assert.equal((await action(booking.id, 'accept')).statusCode, 200);
    for (let i = 0; i < 5; i++)
      assert.equal((await action(booked.id, 'start', '0000')).statusCode, 400);
    assert.equal((await action(booked.id, 'start', booked.code)).statusCode, 429);
    await first.query('UPDATE @rate_limits SET expires_at=0');
    assert.equal((await action(booked.id, 'start', booked.code)).statusCode, 200);
    assert.equal((await call(a, winning, '/dashboard')).json().bookings[0].status, 'confirmed');
    assert.equal((await action(secondBooking.id, 'start', secondBooking.code)).statusCode, 200);
    for (const rider of [winning, losing])
      assert.equal((await call(a, rider, '/dashboard')).json().bookings[0].status, 'in_progress');
    const completionKey = randomUUID();
    assert.equal((await action(booked.id, 'complete', undefined, completionKey)).statusCode, 200);
    assert.equal((await action(booked.id, 'complete', undefined, completionKey)).statusCode, 200);
    const earnings = (await call(a, driver, '/driver/dashboard')).json().earnings;
    assert.deepEqual(earnings, { completed: 1, payout: 270, simulated: true });
    assert.equal(
      Number((await first.query('SELECT count(*) AS n FROM @preview_settlements'))[0].n),
      2,
    );
    await assert.rejects(
      first.query('UPDATE @preview_settlements SET payout_minor=0'),
      /append-only/,
    );
    assert.equal((await call(a, third, '/dashboard')).json().bookings.length, 0);
    // Circle transactions use the same async repository and role boundaries.
    const draft = (await call(a, third, '/pool/bootstrap', {})).json();
    assert.equal((await call(b, third, '/pool/apply', { version: draft.version })).statusCode, 200);
    assert.equal((await action(draft.id, 'accept')).statusCode, 200);
    const accepted = (await call(a, third, '/pool')).json();
    assert.equal((await action(draft.id, 'start', accepted.boardingCode)).statusCode, 200);
    assert.equal((await action(draft.id, 'complete')).statusCode, 200);
    assert.equal((await call(a, third, '/pool')).json().history[0].id, draft.id);
    await call(a, rider, '/auth/logout', {});
    assert.equal((await call(b, rider, '/dashboard')).statusCode, 401);
  },
);
