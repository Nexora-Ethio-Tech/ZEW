import type { PoolState } from '../groups/model.js';
// Ordered schematic stops, not verified road routes or approved boarding points.
export const corridors = [
  {
    id: 'bole-centre',
    name: 'Bole → City centre',
    stops: [
      { id: 'bole', name: 'Bole · Edna Mall', area: 'Bole' },
      { id: 'atlas', name: 'Atlas', area: 'Bole' },
      { id: 'wollosefer', name: 'Wollo Sefer', area: 'Kirkos' },
      { id: 'meskel', name: 'Meskel Square', area: 'Kirkos' },
      { id: 'mexico', name: 'Mexico', area: 'Lideta' },
    ],
  },
  {
    id: 'cmc-centre',
    name: 'CMC → City centre',
    stops: [
      { id: 'cmc', name: 'CMC', area: 'Yeka' },
      { id: 'megenagna', name: 'Megenagna', area: 'Yeka' },
      { id: 'hayahulet', name: 'Haya Hulet', area: 'Bole' },
      { id: 'kazanchis', name: 'Kazanchis', area: 'Kirkos' },
      { id: 'meskel', name: 'Meskel Square', area: 'Kirkos' },
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
