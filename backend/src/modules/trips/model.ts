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
    id: 'bole-cmc',
    name: 'Bole / Wollo Sefer → CMC',
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
      { id: 'hayahulet', name: 'Haya Hulet', area: 'Bole', latitude: 9.0163, longitude: 38.7852 },
      { id: 'megenagna', name: 'Megenagna', area: 'Yeka', latitude: 9.0223, longitude: 38.8037 },
      { id: 'cmc', name: 'CMC', area: 'Yeka', latitude: 9.0201, longitude: 38.854 },
    ],
  },
] as const;

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
  const { start, end } = routePositions(journey);
  return start >= 0 && end >= 0 && start !== end;
}

export function sampleTripsForTime(referenceTime?: string): Trip[] {
  const baseTime = referenceTime ? Date.parse(referenceTime) : Date.now() + 5 * 60000;
  const t = (offsetMinutes: number) => new Date(baseTime + offsetMinutes * 60000).toISOString();

  return [
    {
      id: 'sample-hana',
      corridorId: 'bole-centre',
      origin: 'bole',
      destination: 'mexico',
      departure: t(0),
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
      departure: t(15),
      seats: 2,
      driver: 'Dawit M.',
      vehicle: 'Suzuki Dzire · White',
      fare: 90,
      source: 'sample',
      status: 'open',
    },
    {
      id: 'sample-abebe',
      corridorId: 'bole-centre',
      origin: 'bole',
      destination: 'wollosefer',
      departure: t(5),
      seats: 4,
      driver: 'Abebe K.',
      vehicle: 'Hyundai Atos · Red',
      fare: 75,
      source: 'sample',
      status: 'open',
    },
    {
      id: 'sample-tigist',
      corridorId: 'bole-centre',
      origin: 'atlas',
      destination: 'mexico',
      departure: t(8),
      seats: 3,
      driver: 'Tigist W.',
      vehicle: 'Nissan Note · Grey',
      fare: 85,
      source: 'sample',
      status: 'open',
    },
    {
      id: 'sample-yared',
      corridorId: 'bole-centre',
      origin: 'wollosefer',
      destination: 'mexico',
      departure: t(12),
      seats: 4,
      driver: 'Yared G.',
      vehicle: 'Toyota Corolla · Black',
      fare: 80,
      source: 'sample',
      status: 'open',
    },
    {
      id: 'sample-bethlehem',
      corridorId: 'bole-centre',
      origin: 'wollosefer',
      destination: 'mexico',
      departure: t(20),
      seats: 4,
      driver: 'Bethlehem S.',
      vehicle: 'Volkswagen Polo · Blue',
      fare: 85,
      source: 'sample',
      status: 'open',
    },
    {
      id: 'sample-selam',
      corridorId: 'cmc-centre',
      origin: 'cmc',
      destination: 'meskel',
      departure: t(0),
      seats: 3,
      driver: 'Selam A.',
      vehicle: 'Toyota Yaris · Blue',
      fare: 110,
      source: 'sample',
      status: 'open',
    },
    {
      id: 'sample-ermias',
      corridorId: 'cmc-centre',
      origin: 'cmc',
      destination: 'kazanchis',
      departure: t(10),
      seats: 3,
      driver: 'Ermias K.',
      vehicle: 'Hyundai Elantra · Silver',
      fare: 95,
      source: 'sample',
      status: 'open',
    },
    {
      id: 'sample-kaleb',
      corridorId: 'cmc-centre',
      origin: 'cmc',
      destination: 'hayahulet',
      departure: t(15),
      seats: 4,
      driver: 'Suzuki Swift · White',
      vehicle: 'Suzuki Swift · White',
      fare: 80,
      source: 'sample',
      status: 'open',
    },
    {
      id: 'sample-maron',
      corridorId: 'cmc-centre',
      origin: 'megenagna',
      destination: 'meskel',
      departure: t(8),
      seats: 4,
      driver: 'Maron B.',
      vehicle: 'Toyota Rush · Black',
      fare: 85,
      source: 'sample',
      status: 'open',
    },
    {
      id: 'sample-liya',
      corridorId: 'cmc-centre',
      origin: 'hayahulet',
      destination: 'meskel',
      departure: t(22),
      seats: 3,
      driver: 'Liya H.',
      vehicle: 'Honda Fit · Green',
      fare: 75,
      source: 'sample',
      status: 'open',
    },
    {
      id: 'sample-mahlet',
      corridorId: 'bole-cmc',
      origin: 'wollosefer',
      destination: 'cmc',
      departure: t(5),
      seats: 4,
      driver: 'Mahlet G.',
      vehicle: 'Nissan March · Blue',
      fare: 115,
      source: 'sample',
      status: 'open',
    },
    {
      id: 'sample-samuel',
      corridorId: 'bole-cmc',
      origin: 'bole',
      destination: 'cmc',
      departure: t(12),
      seats: 3,
      driver: 'Samuel T.',
      vehicle: 'Toyota Vitz · White',
      fare: 125,
      source: 'sample',
      status: 'open',
    },
    {
      id: 'sample-dawitk',
      corridorId: 'cmc-centre',
      origin: 'kazanchis',
      destination: 'mexico',
      departure: t(12),
      seats: 4,
      driver: 'Dawit K.',
      vehicle: 'Nissan Note · Silver',
      fare: 90,
      source: 'sample',
      status: 'open',
    },
    {
      id: 'sample-michaelb',
      corridorId: 'bole-cmc',
      origin: 'hayahulet',
      destination: 'cmc',
      departure: t(18),
      seats: 3,
      driver: 'Michael B.',
      vehicle: 'Suzuki Swift · Blue',
      fare: 85,
      source: 'sample',
      status: 'open',
    },
    {
      id: 'sample-rahwaf',
      corridorId: 'bole-cmc',
      origin: 'megenagna',
      destination: 'cmc',
      departure: t(7),
      seats: 4,
      driver: 'Rahwa F.',
      vehicle: 'Volkswagen Polo · Grey',
      fare: 70,
      source: 'sample',
      status: 'open',
    },
    {
      id: 'sample-solomonh',
      corridorId: 'bole-centre',
      origin: 'atlas',
      destination: 'meskel',
      departure: t(14),
      seats: 3,
      driver: 'Solomon H.',
      vehicle: 'Toyota Corolla · Black',
      fare: 80,
      source: 'sample',
      status: 'open',
    },
    {
      id: 'sample-hiwota',
      corridorId: 'cmc-centre',
      origin: 'megenagna',
      destination: 'kazanchis',
      departure: t(9),
      seats: 4,
      driver: 'Hiwot A.',
      vehicle: 'Hyundai Atos · Red',
      fare: 75,
      source: 'sample',
      status: 'open',
    },
  ];
}

export function seedState(): State {
  return {
    commutes: [],
    bookings: [],
    waitlist: null,
    trips: sampleTripsForTime(),
  };
}
