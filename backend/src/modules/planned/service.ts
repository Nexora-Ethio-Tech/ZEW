import { randomInt, randomUUID } from 'node:crypto';
import type { Store } from '../../shared/store.js';
import { ApiError } from '../../shared/http-error.js';
import {
  corridors,
  sampleTripsForTime,
  type Booking,
  type Journey,
  type State,
} from '../trips/model.js';
import { availableSeats, findMatches, rejectionReason } from '../matching/service.js';

export function dashboard(store: Store, sessionId: string) {
  const state = store.read(sessionId);
  const driver = store.dispatchDriver();
  const completed = state.bookings.filter((b) => b.status === 'completed');
  const totalFare = completed.reduce((sum, b) => sum + b.fare, 0);
  const platformFee = Math.round(totalFare * 10) / 100;
  return {
    mode: 'demo',
    corridors,
    trips: state.trips.map((trip) => ({
      ...trip,
      ...(driver ? { driver: driver.name, vehicle: driver.vehicle } : {}),
      availableSeats: Math.min(availableSeats(state, trip), store.availableSeats(trip)),
    })),
    bookings: state.bookings,
    commutes: state.commutes,
    waitlistJoined: !!state.waitlist,
    events: store.events(sessionId),
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

export function matches(store: Store, sessionId: string, input: Journey) {
  const result = findMatches(departures(store.read(sessionId), input.departure), input);
  const driver = store.dispatchDriver();
  const candidates = result.matches.map((trip) => ({
    ...trip,
    ...(driver ? { driver: driver.name, vehicle: driver.vehicle } : {}),
    availableSeats: Math.min(trip.availableSeats, store.availableSeats(trip)),
  }));
  return {
    matches: candidates
      .filter((trip) => trip.availableSeats >= input.seats)
      .map((trip) => ({ ...trip, ...store.issueQuote(sessionId, input, trip) })),
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

export function quote(store: Store, sessionId: string, input: Journey & { tripId: string }) {
  const candidates = departures(store.read(sessionId), input.departure);
  const trip = candidates.trips.find((t) => t.id === input.tripId);
  if (!trip) throw new ApiError(404, 'Trip not found');
  const reason = rejectionReason(candidates, trip, input);
  if (reason) throw new ApiError(409, reason);
  return {
    ...store.issueQuote(sessionId, input, trip),
    fare: trip.fare * input.seats,
    departure: trip.departure,
    seats: input.seats,
  };
}

export function reserve(store: Store, sessionId: string, quoteId: string) {
  return store.mutate(sessionId, 'booking.confirmed', (state) => {
    const snapshot = store.quote(sessionId, quoteId);
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
    store.consumeQuote(quoteId, booking.id);
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
