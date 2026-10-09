import type { DatabaseSync } from 'node:sqlite';
import { randomInt, randomUUID } from 'node:crypto';
import type { State, Trip } from '../trips/model.js';
import { corridors } from '../trips/model.js';
import { acceptGroup, fareQuote, GroupError, poolView, syncExpiry } from '../groups/service.js';
import type { DriverProfile, DispatchRequest } from './model.js';

export interface AssignedRow {
  id: string;
  kind: 'circle' | 'planned';
  workspace_id: string;
  driver_id: string;
  status: string;
  departure_id: string | null;
}
const active = ['requested', 'accepted', 'in_progress'];

export function remainingSeats(db: DatabaseSync, trip: Trip) {
  const driver = db
    .prepare(
      'SELECT d.id, d.seats FROM driver_access d JOIN dispatch_settings s ON s.test_driver_id = d.id WHERE s.id = 1 AND d.active = 1',
    )
    .get();
  if (!driver) return 0;
  const departure = db
    .prepare(
      'SELECT status,capacity FROM planned_departures WHERE driver_id=? AND trip_id=? AND departure=?',
    )
    .get(driver.id, trip.id, trip.departure);
  if (departure && departure.status !== 'open') return 0;
  const held = db
    .prepare(
      "SELECT COALESCE(SUM(json_extract(data, '$.seats')), 0) AS seats FROM dispatch_requests WHERE driver_id = (SELECT test_driver_id FROM dispatch_settings WHERE id = 1) AND kind = 'planned' AND status IN ('requested','accepted','in_progress') AND json_extract(data, '$.tripId') = ? AND json_extract(data, '$.departure') = ?",
    )
    .get(trip.id, trip.departure)!.seats as number;
  return Math.max(
    0,
    Math.min(trip.seats, Number(driver.seats), Number(departure?.capacity ?? driver.seats)) - held,
  );
}

// Runs inside the caller's SQLite transaction, together with the passenger state change.
export function syncDispatch(db: DatabaseSync, workspaceId: string, state: State) {
  const configured = db
    .prepare(
      'SELECT d.id, d.name, d.vehicle, d.seats FROM driver_access d JOIN dispatch_settings s ON s.test_driver_id = d.id WHERE s.id = 1 AND d.active = 1',
    )
    .get() as unknown as DriverProfile | undefined;
  const save = (request: DispatchRequest, capacity?: number): DriverProfile | undefined => {
    const existing = db
      .prepare('SELECT driver_id, workspace_id, departure_id FROM dispatch_requests WHERE id = ?')
      .get(request.id);
    const driver = existing
      ? (db
          .prepare('SELECT id, name, vehicle, seats FROM driver_access WHERE id = ?')
          .get(existing.driver_id) as unknown as DriverProfile)
      : configured;
    if (!existing && request.status !== 'requested') return;
    if (!driver)
      throw new GroupError('No approved driver is available to receive this request.', 409);
    if (existing && existing.workspace_id !== workspaceId)
      throw new GroupError('Request ownership conflict.', 409);
    if (active.includes(request.status) && request.seats > driver.seats)
      throw new GroupError('The assigned vehicle does not have enough seats.', 409);
    let departureId = existing?.departure_id as string | undefined;
    if (request.kind === 'planned') {
      db.prepare(
        `INSERT INTO planned_departures(id,driver_id,trip_id,departure,capacity)
        VALUES (?,?,?,?,?) ON CONFLICT(driver_id,trip_id,departure) DO NOTHING`,
      ).run(
        randomUUID(),
        driver.id,
        request.tripId!,
        request.departure!,
        Math.min(driver.seats, capacity ?? driver.seats),
      );
      const departure = db
        .prepare(
          'SELECT id,status,capacity FROM planned_departures WHERE driver_id=? AND trip_id=? AND departure=?',
        )
        .get(driver.id, request.tripId!, request.departure!)!;
      departureId = departure.id as string;
      capacity = Math.min(capacity ?? driver.seats, Number(departure.capacity));
      if (!existing && departure.status !== 'open')
        throw new GroupError('Boarding has begun for this departure. Choose another ride.', 409);
      request.departureId = departureId;
    }
    // A departure's seats are shared across passenger workspaces, never counted per browser.
    if (request.kind === 'planned' && active.includes(request.status)) {
      const held = db
        .prepare(
          "SELECT COALESCE(SUM(json_extract(data, '$.seats')), 0) AS seats FROM dispatch_requests WHERE driver_id = ? AND id != ? AND kind = 'planned' AND status IN ('requested','accepted','in_progress') AND json_extract(data, '$.tripId') = ? AND json_extract(data, '$.departure') = ?",
        )
        .get(driver.id, request.id, request.tripId!, request.departure!)!.seats as number;
      if (held + request.seats > Math.min(driver.seats, capacity ?? driver.seats))
        throw new GroupError('There are no longer enough seats for this departure.', 409);
    }
    const now = new Date().toISOString();
    db.prepare(
      'INSERT INTO dispatch_requests(id,kind,workspace_id,driver_id,status,data,created_at,updated_at,departure_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?) ON CONFLICT(id) DO UPDATE SET status = excluded.status, data = excluded.data, updated_at = excluded.updated_at, departure_id = excluded.departure_id',
    ).run(
      request.id,
      request.kind,
      workspaceId,
      driver.id,
      request.status,
      JSON.stringify(request),
      now,
      now,
      departureId ?? null,
    );
    if (request.status === 'completed') {
      const gross = Math.round(request.fare * 100),
        payout = Math.round(request.payout * 100);
      db.prepare(
        `INSERT INTO preview_settlements(request_id,driver_id,departure_id,gross_minor,fee_minor,payout_minor,created_at)
        VALUES (?,?,?,?,?,?,?) ON CONFLICT(request_id) DO NOTHING`,
      ).run(request.id, driver.id, departureId ?? null, gross, gross - payout, payout, now);
    }
    if (departureId) {
      db.prepare(
        `UPDATE planned_departures SET status=CASE WHEN EXISTS
        (SELECT 1 FROM dispatch_requests WHERE departure_id=? AND status='accepted') THEN 'boarding' ELSE 'open' END
        WHERE id=? AND status IN ('open','boarding')`,
      ).run(departureId, departureId);
    }
    return driver;
  };
  const pool = state.pool;
  if (pool && pool.status !== 'draft') {
    syncExpiry(pool);
    const view = poolView(pool),
      quote = fareQuote(pool);
    const driver = save({
      id: pool.id,
      kind: 'circle',
      status: pool.status,
      riderName: state.user?.name ?? 'Passenger',
      pickup: view.pickupName,
      destination: view.mapDestination.name,
      pickupPoint: {
        latitude: view.mapPickup.latitude,
        longitude: view.mapPickup.longitude,
        label: view.pickupName,
      },
      destinationPoint: {
        latitude: view.mapDestination.latitude,
        longitude: view.mapDestination.longitude,
        label: view.mapDestination.name,
      },
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
  for (const booking of state.bookings) {
    const stopName = (id: string) =>
      corridors.flatMap((c) => c.stops).find((s) => s.id === id)?.name ?? id;
    const driver = save(
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
        pickupPoint: stopPoint(booking.origin),
        destinationPoint: stopPoint(booking.destination),
        seats: booking.seats,
        fare: booking.fare,
        payout: Math.round(booking.fare * 90) / 100,
        tripId: booking.tripId,
        boardingVerified: !!booking.boardingVerified,
        departure: booking.departure,
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

function stopPoint(id: string) {
  const stop = corridors.flatMap((corridor) => corridor.stops).find((item) => item.id === id);
  return stop
    ? { latitude: stop.latitude, longitude: stop.longitude, label: stop.name }
    : undefined;
}

export function driverAction(state: State, request: AssignedRow, action: string, code?: string) {
  if (request.kind === 'circle') {
    const pool = state.pool;
    if (!pool || pool.id !== request.id)
      throw new GroupError('This request is no longer active.', 409);
    syncExpiry(pool);
    if (action === 'accept') acceptGroup(pool);
    else if (action === 'decline' && pool.status === 'requested') {
      pool.status = 'cancelled';
      pool.version++;
    } else if (action === 'start' && pool.status === 'accepted') {
      if (!code || code !== pool.boardingCode)
        throw new GroupError('That boarding code does not match.', 400);
      pool.status = 'in_progress';
      pool.version++;
    } else if (action === 'complete' && pool.status === 'in_progress') {
      const view = poolView(pool),
        quote = fareQuote(pool);
      pool.status = 'completed';
      pool.version++;
      pool.history.unshift({
        id: pool.id,
        route: view.pickupName + ' → ' + view.mapDestination.name,
        members: quote.count,
        fare: pool.lockedFare ?? quote.yourFare,
        date: new Date().toISOString(),
        demo: true,
        driverId: request.driver_id,
        total: quote.total,
        fee: quote.fee,
        driverPayout: quote.driverPayout,
      });
      pool.history = pool.history.slice(0, 30);
    } else throw new GroupError('This action is not available for the current ride status.', 409);
  } else {
    const booking = state.bookings.find((b) => b.id === request.id);
    if (!booking) throw new GroupError('Booking not found.', 404);
    if (action === 'accept' && booking.status === 'confirmed' && !booking.driverAccepted)
      booking.driverAccepted = true;
    else if (action === 'decline' && booking.status === 'confirmed' && !booking.driverAccepted)
      booking.status = 'cancelled';
    else if (action === 'start' && booking.status === 'confirmed' && booking.driverAccepted) {
      if (code !== booking.code) throw new GroupError('That boarding code does not match.', 400);
      booking.boardingVerified = true;
    } else if (action === 'complete' && booking.status === 'in_progress') {
      booking.status = 'completed';
      booking.payment = 'simulated';
    } else throw new GroupError('This action is not available for the current ride status.', 409);
  }
  return { ok: true };
}
