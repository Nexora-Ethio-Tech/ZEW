import type { PoolState } from '../groups/model.js';
// Ordered schematic stops, not verified road routes or approved boarding points.
export const corridors = [
  {
    id: 'bole-centre',
    name: 'Bole → City centre',
    stops: [
      { id: 'bole', name: 'Bole · Edna Mall', area: 'Bole', latitude: 8.9982, longitude: 38.7865 },
      { id: 'atlas', name: 'Atlas', area: 'Bole', latitude: 9.0035, longitude: 38.7798 },
      {
        id: 'wollosefer',
        name: 'Wollo Sefer',
        area: 'Kirkos',
        latitude: 9.0069,
        longitude: 38.7709,
      },
      { id: 'meskel', name: 'Meskel Square', area: 'Kirkos', latitude: 9.0105, longitude: 38.7618 },
      { id: 'mexico', name: 'Mexico', area: 'Lideta', latitude: 9.0103, longitude: 38.7454 },
    ],
  },
  {
    id: 'cmc-centre',
    name: 'CMC → City centre',
    stops: [
      { id: 'cmc', name: 'CMC', area: 'Yeka', latitude: 9.0201, longitude: 38.854 },
      { id: 'megenagna', name: 'Megenagna', area: 'Yeka', latitude: 9.0223, longitude: 38.8037 },
      { id: 'hayahulet', name: 'Haya Hulet', area: 'Bole', latitude: 9.0163, longitude: 38.7852 },
      { id: 'kazanchis', name: 'Kazanchis', area: 'Kirkos', latitude: 9.0147, longitude: 38.7702 },
      { id: 'meskel', name: 'Meskel Square', area: 'Kirkos', latitude: 9.0105, longitude: 38.7618 },
    ],
  },
] as const;
export interface Journey {
  corridorId: string;
  origin: string;
  destination: string;
  departure: string;
  seats: number;
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
  id: string;
  tripId: string;
  driver: string;
  vehicle: string;
  fare: number;
  status: 'confirmed' | 'in_progress' | 'completed' | 'cancelled';
  code: string;
  createdAt: string;
  payment: 'not_due' | 'simulated';
}
export interface Commute extends Journey {
  id: string;
  name: string;
}
export interface State {
  pool?: PoolState;
  trips: Trip[];
  bookings: Booking[];
  commutes: Commute[];
  waitlist: { name: string; email: string; role: string; consentAt: string } | null;
}
export function routePositions(journey: Pick<Journey, 'corridorId' | 'origin' | 'destination'>) {
  const corridor = corridors.find((c) => c.id === journey.corridorId);
  return {
    start: corridor?.stops.findIndex((s) => s.id === journey.origin) ?? -1,
    end: corridor?.stops.findIndex((s) => s.id === journey.destination) ?? -1,
  };
}
export function validRoute(journey: Pick<Journey, 'corridorId' | 'origin' | 'destination'>) {
  const { start, end } = routePositions(journey);
  return start >= 0 && end >= 0 && start !== end;
}
export function seedState(): State {
  const date = new Date(Date.now() + 27 * 3600000).toISOString().slice(0, 10);
  const departure = `${date}T08:00:00+03:00`;
  return {
    commutes: [],
    bookings: [],
    waitlist: null,
    trips: [
      {
        id: 'sample-hana',
        corridorId: 'bole-centre',
        origin: 'bole',
        destination: 'mexico',
        departure,
        seats: 3,
        driver: 'Hana T.',
        vehicle: 'Toyota Vitz · Silver',
        fare: 100,
        source: 'sample',
        status: 'open',
      },
      {
        id: 'sample-dawit',
        corridorId: 'bole-centre',
        origin: 'bole',
        destination: 'meskel',
        departure: `${date}T08:15:00+03:00`,
        seats: 2,
        driver: 'Dawit M.',
        vehicle: 'Suzuki Dzire · White',
        fare: 90,
        source: 'sample',
        status: 'open',
      },
      {
        id: 'sample-selam',
        corridorId: 'cmc-centre',
        origin: 'cmc',
        destination: 'meskel',
        departure,
        seats: 3,
        driver: 'Selam A.',
        vehicle: 'Toyota Yaris · Blue',
        fare: 110,
        source: 'sample',
        status: 'open',
      },
    ],
  };
}
