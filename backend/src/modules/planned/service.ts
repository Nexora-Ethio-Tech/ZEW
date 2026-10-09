import { randomInt, randomUUID } from 'node:crypto';
import type { DataStore as Store } from '../../shared/data-store.js';
import { ApiError } from '../../shared/http-error.js';
import {
  corridors,
  sampleTripsForTime,
  type Booking,
  type Journey,
  type State,
} from '../trips/model.js';
import { availableSeats, findMatches, rejectionReason } from '../matching/service.js';
import { demoDemandZones } from '../groups/model.js';

export async function dashboard(store: Store, sessionId: string) {
  const state = await store.read(sessionId);
  const driver = await store.dispatchDriver();
  const completed = state.bookings.filter((b) => b.status === 'completed');
  const totalFare = completed.reduce((sum, b) => sum + b.fare, 0);
  const platformFee = Math.round(totalFare * 10) / 100;
  return {
    mode: 'demo',
    corridors,
    // Aggregate points from the seeded preview catalog; never expose rider identities.
    previewDemand: demoDemandZones,
    trips: await Promise.all(
      state.trips.map(async (trip) => ({
        ...trip,
        ...(driver ? { driver: driver.name, vehicle: driver.vehicle } : {}),
        availableSeats: Math.min(availableSeats(state, trip), await store.availableSeats(trip)),
      })),
    ),
    bookings: state.bookings,
    commutes: state.commutes,
    waitlistJoined: !!state.waitlist,
    events: await store.events(sessionId),
    demoEarnings: {
      completedTrips: completed.length,
      totalFare,
      platformFee,
      driverPayout: totalFare - platformFee,
    },
  };
}

function departures(state: State, referenceTime: string): State {
  return {
    ...state,
    trips: [
      ...sampleTripsForTime(referenceTime),
      ...state.trips.filter((trip) => trip.source === 'yours'),
    ],
  };
}

export async function matches(store: Store, sessionId: string, input: Journey) {
  const result = findMatches(departures(await store.read(sessionId), input.departure), input);
  const driver = await store.dispatchDriver();
  const candidates = await Promise.all(
    result.matches.map(async (trip) => ({
      ...trip,
      ...(driver ? { driver: driver.name, vehicle: driver.vehicle } : {}),
      availableSeats: Math.min(trip.availableSeats, await store.availableSeats(trip)),
    })),
  );
  return {
    matches: await Promise.all(
      candidates
        .filter((trip) => trip.availableSeats >= input.seats)
        .map(async (trip) => ({ ...trip, ...(await store.issueQuote(sessionId, input, trip)) })),
    ),
    rejected: [
      ...result.rejected,
      ...candidates
        .filter((trip) => trip.availableSeats < input.seats)
        .map((trip) => ({
          tripId: trip.id,
          reason: driver ? 'Not enough seats' : 'No assigned driver available',
        })),
    ],
  };
}

export async function reserveWithinBudget(
  store: Store,
  sessionId: string,
  input: Journey & { maxFare: number },
) {
  const { maxFare, ...journey } = input;
  const results = await matches(store, sessionId, journey);
  const selected = results.matches
    .filter((trip) => trip.fare <= maxFare)
    .sort((a, b) => a.fare - b.fare || a.differenceMinutes - b.differenceMinutes)[0];
  if (!selected)
    throw new ApiError(
      409,
      'No group match is available within that fare limit. Try a higher limit or another departure.',
    );
  const booking = await reserve(store, sessionId, selected.quoteId!);
  return { booking, assignedFarePerSeat: selected.fare, assignedDeparture: selected.departure };
}

export async function quote(store: Store, sessionId: string, input: Journey & { tripId: string }) {
  const candidates = departures(await store.read(sessionId), input.departure);
  const trip = candidates.trips.find((t) => t.id === input.tripId);
  if (!trip) throw new ApiError(404, 'Trip not found');
  const reason = rejectionReason(candidates, trip, input);
  if (reason) throw new ApiError(409, reason);
  return {
    ...(await store.issueQuote(sessionId, input, trip)),
    fare: trip.fare * input.seats,
    departure: trip.departure,
    seats: input.seats,
  };
}

export function reserve(store: Store, sessionId: string, quoteId: string) {
  return store.reserveQuoted(sessionId, quoteId, (state, snapshot) => {
    if (snapshot.bookingId) {
      const booked = state.bookings.find((booking) => booking.id === snapshot.bookingId);
      if (!booked) throw new ApiError(409, 'Reservation needs operator review.');
      return { value: booked, entityId: booked.id };
    }
    const { journey: input, trip } = snapshot;
    const reason = rejectionReason({ ...state, trips: [trip] }, trip, input);
    if (reason) throw new ApiError(409, reason);
    // The fare and actual departure come from the selected server-owned listing.
    const booking: Booking = {
      ...input,
      id: randomUUID(),
      tripId: trip.id,
      departure: trip.departure,
      driver: trip.driver,
      vehicle: trip.vehicle,
      fare: trip.fare * input.seats,
      status: 'confirmed',
      code: String(randomInt(1000, 10000)),
      createdAt: new Date().toISOString(),
      payment: 'not_due',
    };
    state.trips = [...state.trips.filter((t) => t.id !== trip.id), trip];
    state.bookings.unshift(booking);
    // Store commits the seat allocation and dispatch assignment in this same transaction.
    return { value: booking, entityId: booking.id };
  });
}

export function cancel(store: Store, sessionId: string, id: string) {
  return store.mutate(sessionId, 'booking.cancel', (state) => {
    const booking = state.bookings.find((b) => b.id === id);
    if (!booking) throw new ApiError(404, 'Booking not found');
    if (booking.status !== 'confirmed' || booking.boardingVerified)
      throw new ApiError(409, 'This action is not available for the current trip status');
    booking.status = 'cancelled';
    return { value: booking, entityId: id };
  });
}

export function saveCommute(store: Store, sessionId: string, input: Journey & { name: string }) {
  return store.mutate(sessionId, 'commute.saved', (state) => {
    if (state.commutes.length >= 10) throw new ApiError(409, 'You can save up to 10 commutes');
    const commute = { ...input, id: randomUUID() };
    state.commutes.push(commute);
    return { value: commute, entityId: commute.id };
  });
}

export function removeCommute(store: Store, sessionId: string, id: string) {
  return store.mutate(sessionId, 'commute.removed', (state) => {
    if (!state.commutes.some((c) => c.id === id)) throw new ApiError(404, 'Commute not found');
    state.commutes = state.commutes.filter((c) => c.id !== id);
    return { value: { ok: true }, entityId: id };
  });
}
