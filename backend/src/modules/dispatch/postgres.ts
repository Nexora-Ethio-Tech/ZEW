import { randomInt, randomUUID } from 'node:crypto';
import type { State, Trip } from '../trips/model.js';
import { corridors } from '../trips/model.js';
import type { DriverProfile, DispatchRequest } from './model.js';
import { fareQuote, poolView, syncExpiry, GroupError } from '../groups/service.js';
export type Query = (sql: string, parameters?: unknown[]) => Promise<Record<string, any>[]>;
export async function postgresSeats(query: Query, trip: Trip) {
  const [driver] = await query(
    'SELECT d.id,d.seats FROM @driver_access d JOIN @dispatch_settings s ON s.test_driver_id=d.id WHERE d.active=1 AND s.id=1',
  );
  if (!driver) return 0;
  const [departure] = await query(
    'SELECT status,capacity FROM @planned_departures WHERE driver_id=$1 AND trip_id=$2 AND departure=$3',
    [driver.id, trip.id, trip.departure],
  );
  if (departure && departure.status !== 'open') return 0;
  const [held] = await query(
    `SELECT COALESCE(SUM((data->>'seats')::int),0) AS seats FROM @dispatch_requests
    WHERE driver_id=$1 AND kind='planned' AND status IN('requested','accepted','in_progress') AND data->>'tripId'=$2 AND data->>'departure'=$3`,
    [driver.id, trip.id, trip.departure],
  );
  return Math.max(
    0,
    Math.min(trip.seats, driver.seats, departure?.capacity ?? driver.seats) - Number(held.seats),
  );
}
export async function syncPostgresDispatch(query: Query, workspaceId: string, state: State) {
  const [configured] = await query(
    'SELECT d.id,d.name,d.vehicle,d.seats FROM @driver_access d JOIN @dispatch_settings s ON s.test_driver_id=d.id WHERE d.active=1 AND s.id=1',
  );
  async function save(
    request: DispatchRequest,
    capacity?: number,
  ): Promise<DriverProfile | undefined> {
    const [existing] = await query(
      'SELECT driver_id,workspace_id,departure_id FROM @dispatch_requests WHERE id=$1',
      [request.id],
    );
    const driver = existing
      ? (
          await query('SELECT id,name,vehicle,seats FROM @driver_access WHERE id=$1', [
            existing.driver_id,
          ])
        )[0]
      : configured;
    if (!existing && request.status !== 'requested') return;
    if (!driver)
      throw new GroupError('No approved driver is available to receive this request.', 409);
    if (existing && existing.workspace_id !== workspaceId)
      throw new GroupError('Request ownership conflict.', 409);
    const active = ['requested', 'accepted', 'in_progress'].includes(request.status);
    if (active && request.seats > driver.seats)
      throw new GroupError('The assigned vehicle does not have enough seats.', 409);
    let departureId: string | null = existing?.departure_id ?? null;
    if (request.kind === 'planned') {
      await query(
        `INSERT INTO @planned_departures(id,driver_id,trip_id,departure,capacity) VALUES($1,$2,$3,$4,$5)
        ON CONFLICT(driver_id,trip_id,departure) DO NOTHING`,
        [
          randomUUID(),
          driver.id,
          request.tripId,
          request.departure,
          Math.min(driver.seats, capacity ?? driver.seats),
        ],
      );
      const [departure] = await query(
        'SELECT id,status,capacity FROM @planned_departures WHERE driver_id=$1 AND trip_id=$2 AND departure=$3',
        [driver.id, request.tripId, request.departure],
      );
      departureId = departure.id;
      request.departureId = departure.id;
      if (!existing && departure.status !== 'open')
        throw new GroupError('Boarding has begun for this departure. Choose another ride.', 409);
      if (active) {
        const [held] = await query(
          `SELECT COALESCE(SUM((data->>'seats')::int),0) AS seats FROM @dispatch_requests
          WHERE departure_id=$1 AND id!=$2 AND status IN('requested','accepted','in_progress')`,
          [departureId, request.id],
        );
        if (
          Number(held.seats) + request.seats >
          Math.min(driver.seats, capacity ?? driver.seats, departure.capacity)
        )
          throw new GroupError('There are no longer enough seats for this departure.', 409);
      }
    }
    const now = new Date().toISOString();
    await query(
      `INSERT INTO @dispatch_requests(id,kind,workspace_id,driver_id,status,data,created_at,updated_at,departure_id)
      VALUES($1,$2,$3,$4,$5,$6,$7,$7,$8) ON CONFLICT(id) DO UPDATE SET status=excluded.status,data=excluded.data,updated_at=excluded.updated_at,departure_id=excluded.departure_id`,
      [
        request.id,
        request.kind,
        workspaceId,
        driver.id,
        request.status,
        JSON.stringify(request),
        now,
        departureId,
      ],
    );
    if (request.status === 'completed') {
      const gross = Math.round(request.fare * 100),
        payout = Math.round(request.payout * 100);
      await query(
        `INSERT INTO @preview_settlements(request_id,driver_id,departure_id,gross_minor,fee_minor,payout_minor,created_at)
        VALUES($1,$2,$3,$4,$5,$6,$7) ON CONFLICT(request_id) DO NOTHING`,
        [request.id, driver.id, departureId, gross, gross - payout, payout, now],
      );
    }
    if (departureId)
      await query(
        `UPDATE @planned_departures SET status=CASE WHEN EXISTS
      (SELECT 1 FROM @dispatch_requests WHERE departure_id=$1 AND status='accepted') THEN 'boarding' ELSE 'open' END
      WHERE id=$1 AND status IN('open','boarding')`,
        [departureId],
      );
    return driver as DriverProfile;
  }
  const pool = state.pool;
  if (pool && pool.status !== 'draft') {
    syncExpiry(pool);
    const view = poolView(pool),
      quote = fareQuote(pool);
    const driver = await save({
      id: pool.id,
      kind: 'circle',
      status: pool.status,
      riderName: state.user?.name ?? 'Passenger',
      pickup: view.pickupName,
      destination: view.mapDestination.name,
      seats: quote.count,
      fare: quote.total,
      payout: quote.driverPayout,
      requestedUntil: pool.requestedUntil,
      preview: true,
    });
    if (driver) {
      pool.assignedDriver = driver;
      pool.boardingCode ??= String(randomInt(1000, 10000));
    }
  }
  const stopName = (id: string) =>
    corridors.flatMap((c) => c.stops).find((s) => s.id === id)?.name ?? id;
  for (const booking of state.bookings) {
    const driver = await save(
      {
        id: booking.id,
        kind: 'planned',
        status:
          booking.status === 'confirmed'
            ? booking.driverAccepted
              ? 'accepted'
              : 'requested'
            : booking.status,
        riderName: state.user?.name ?? 'Passenger',
        pickup: stopName(booking.origin),
        destination: stopName(booking.destination),
        seats: booking.seats,
        fare: booking.fare,
        payout: Math.round(booking.fare * 90) / 100,
        tripId: booking.tripId,
        departure: booking.departure,
        boardingVerified: !!booking.boardingVerified,
        preview: true,
      },
      state.trips.find((trip) => trip.id === booking.tripId)?.seats,
    );
    if (driver) {
      booking.driver = driver.name;
      booking.vehicle = driver.vehicle;
    }
  }
}
