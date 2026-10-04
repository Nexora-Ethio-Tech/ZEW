import { routePositions, sampleTripsForTime, type Journey, type State, type Trip } from '../trips/model.js';

export function availableSeats(state: State, trip: Trip) {
  // Conservative: a booking occupies seats for the whole driver trip, even after completion.
  return (
    trip.seats -
    state.bookings
      .filter((b) => b.tripId === trip.id && b.status !== 'cancelled')
      .reduce((n, b) => n + b.seats, 0)
  );
}

export function rejectionReason(
  state: State,
  trip: Trip,
  request: Journey,
  now = Date.now(),
): string | null {
  if (trip.status !== 'open') return 'Trip is no longer available';
  if (trip.source === 'yours') return 'You cannot book your own trip';
  if (trip.corridorId !== request.corridorId) return 'Different corridor';
  if (Date.parse(trip.departure) <= now - 5 * 60000) return 'Trip has already departed';
  const driver = routePositions(trip),
    rider = routePositions(request);
  const forward = Math.sign(driver.end - driver.start);
  if (forward !== Math.sign(rider.end - rider.start)) return 'Opposite direction';
  if ((rider.start - driver.start) * forward < 0 || (driver.end - rider.end) * forward < 0)
    return 'Outside the driver route';
  if (Math.abs(Date.parse(trip.departure) - Date.parse(request.departure)) > 30 * 60000)
    return 'Outside your 30-minute window';
  if (availableSeats(state, trip) < request.seats) return 'Not enough seats';
  if (state.bookings.some((b) => b.tripId === trip.id && b.status !== 'cancelled'))
    return 'You already have a booking on this trip';
  return null;
}

export function findMatches(state: State, request: Journey) {
  const dynamicSamples = sampleTripsForTime(request.departure);
  const allTripsMap = new Map<string, Trip>();

  for (const t of state.trips) {
    allTripsMap.set(t.id, t);
  }
  for (const sample of dynamicSamples) {
    if (!allTripsMap.has(sample.id)) {
      allTripsMap.set(sample.id, sample);
    }
  }

  const candidateTrips = Array.from(allTripsMap.values());

  const matches = candidateTrips
    .filter((t) => !rejectionReason(state, t, request))
    .map((t) => ({
      ...t,
      totalFare: t.fare * request.seats,
      availableSeats: availableSeats(state, t),
      differenceMinutes: Math.round(
        Math.abs(Date.parse(t.departure) - Date.parse(request.departure)) / 60000,
      ),
    }))
    .sort((a, b) => a.differenceMinutes - b.differenceMinutes || a.fare - b.fare);

  const rejected = candidateTrips
    .filter((t) => !matches.some((m) => m.id === t.id))
    .map((t) => ({ tripId: t.id, reason: rejectionReason(state, t, request) }));

  return { matches, rejected };
}
