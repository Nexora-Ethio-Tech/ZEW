import type { PoolState } from '../groups/model.js';
import type { DatabaseSync } from 'node:sqlite';
import { initialPlannedCatalog, loadPlannedCatalog, type PlannedCatalog } from './catalog.js';

let plannedCatalog = initialPlannedCatalog;
export let corridors = plannedCatalog.corridors;

export function activatePlannedCatalog(db: DatabaseSync) {
  setPlannedCatalog(loadPlannedCatalog(db));
}
export function setPlannedCatalog(catalog: PlannedCatalog) {
  plannedCatalog = catalog;
  corridors = plannedCatalog.corridors;
}

export interface Journey {
  corridorId: string;
  origin: string;
  destination: string;
  departure: string;
  seats: number;
  minSeats?: number;
  maxSeats?: number;
}
export interface Trip extends Journey {
  id: string;
  driver: string;
  vehicle: string;
  fare: number;
  source: 'sample' | 'yours';
  status: 'open' | 'cancelled';
}
export interface Booking extends Journey {
  driverAccepted?: boolean;
  boardingVerified?: boolean;
  id: string;
  tripId: string;
  driver: string;
  vehicle: string;
  fare: number;
  status: 'confirmed' | 'in_progress' | 'completed' | 'cancelled';
  code: string;
  createdAt: string;
  payment: 'not_due' | 'pending_telebirr' | 'paid_telebirr' | 'simulated' | 'failed';
}
export interface Commute extends Journey {
  id: string;
  name: string;
}
export interface State {
  user?: { id: string; email: string; name: string; role: string };
  pool?: PoolState;
  trips: Trip[];
  bookings: Booking[];
  commutes: Commute[];
  waitlist: { name: string; email: string; role: string; consentAt: string } | null;
}

export function findCorridorForStops(originId: string, destinationId: string) {
  const matching = corridors.find(
    (c) => c.stops.some((s) => s.id === originId) && c.stops.some((s) => s.id === destinationId),
  );
  if (matching) return matching;
  return corridors.find((c) => c.stops.some((s) => s.id === originId)) ?? corridors[0];
}

export function routePositions(journey: Pick<Journey, 'corridorId' | 'origin' | 'destination'>) {
  let corridor = corridors.find((c) => c.id === journey.corridorId);
  let start = corridor?.stops.findIndex((s) => s.id === journey.origin) ?? -1;
  let end = corridor?.stops.findIndex((s) => s.id === journey.destination) ?? -1;

  if (start < 0 || end < 0) {
    const fallback = findCorridorForStops(journey.origin, journey.destination);
    start = fallback.stops.findIndex((s) => s.id === journey.origin);
    end = fallback.stops.findIndex((s) => s.id === journey.destination);
  }

  return { start, end };
}

export function validRoute(journey: Pick<Journey, 'corridorId' | 'origin' | 'destination'>) {
  const corridor = corridors.find((c) => c.id === journey.corridorId);
  return Boolean(
    corridor &&
    journey.origin !== journey.destination &&
    corridor.stops.some((stop) => stop.id === journey.origin) &&
    corridor.stops.some((stop) => stop.id === journey.destination),
  );
}

export function sampleTripsForTime(referenceTime?: string): Trip[] {
  // A sample departure is a shared time slot, identical across independently opened accounts.
  const baseTime = referenceTime
    ? Math.ceil(Date.parse(referenceTime) / 900000) * 900000
    : Math.ceil((Date.now() + 5 * 60000) / 900000) * 900000;
  return plannedCatalog.trips.map(({ offsetMinutes, ...trip }) => ({
    ...trip,
    departure: new Date(baseTime + offsetMinutes * 60000).toISOString(),
  }));
}

export function seedState(): State {
  return {
    commutes: [],
    bookings: [],
    waitlist: null,
    trips: sampleTripsForTime(),
  };
}
