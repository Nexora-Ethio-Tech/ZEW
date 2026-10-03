import { randomUUID } from 'node:crypto';

export const MAX_PICKUP_SECONDS = 120;
export const MAX_LOCATION_AGE_MS = 120_000;
export const MAX_MEMBERS = 4;
// Fictional travel times on a directed demo corridor, not GPS-derived road ETAs.
export const pickupZones = [
  { id: 'edna', name: 'Edna Mall, Bole', latitude: 8.9982, longitude: 38.7865 },
  { id: 'atlas', name: 'Atlas, Bole', latitude: 9.0035, longitude: 38.7798 },
] as const;
export const destinations = [
  { id: 'wollosefer', name: 'Wollo Sefer', fare: 300, order: 3 },
  { id: 'meskel', name: 'Meskel Square', fare: 360, order: 4 },
  { id: 'mexico', name: 'Mexico', fare: 420, order: 5 },
] as const;
export const demoDrivers = [
  {
    id: 'hana',
    name: 'Hana T.',
    car: 'Toyota Vitz',
    plate: 'DEMO 2048',
    seats: 4,
    etaSeconds: 20,
    direction: 'forward',
  },
  {
    id: 'dawit',
    name: 'Dawit M.',
    car: 'Suzuki Dzire',
    plate: 'DEMO 3061',
    seats: 3,
    etaSeconds: 45,
    direction: 'forward',
  },
  {
    id: 'abel',
    name: 'Abel K.',
    car: 'Toyota Yaris',
    plate: 'DEMO 1802',
    seats: 4,
    etaSeconds: 180,
    direction: 'forward',
  },
] as const;
export interface DeviceLocation {
  latitude: number;
  longitude: number;
  accuracy: number;
  timestamp: number;
}
export interface Place {
  name: string;
  latitude: number;
  longitude: number;
}
export interface PoolRider {
  id: string;
  name: string;
  initials: string;
  color: string;
  destination: string;
  pickup: string;
  pickupSeconds: number;
  direction: 'forward' | 'reverse';
  readyUntil: number;
  locationAt: number;
  optedIn: boolean;
}
export type GroupStatus =
  'draft' | 'requested' | 'accepted' | 'in_progress' | 'completed' | 'cancelled' | 'expired';
export interface PoolState {
  id: string;
  version: number;
  destination: string;
  zoneId: string | null;
  locationSource: 'demo' | 'device' | 'place';
  pickupPlace?: Place;
  destinationPlace?: Place;
  location?: DeviceLocation;
  riders: PoolRider[];
  selectedIds: string[];
  skippedIds: string[];
  status: GroupStatus;
  requestedUntil?: number;
  lockedFare?: number;
  driverId?: string;
  targetSeats?: number;
  history: { id: string; route: string; members: number; fare: number; date: string; demo: true }[];
}
export function demoRiders(now = Date.now()): PoolRider[] {
  return [
    {
      id: 'sara',
      name: 'Sara M.',
      initials: 'SM',
      color: 'peach',
      pickup: 'In front of the café',
      pickupSeconds: 35,
      destination: 'meskel',
      direction: 'forward' as const,
    },
    {
      id: 'bereket',
      name: 'Bereket A.',
      initials: 'BA',
      color: 'lavender',
      pickup: 'At the next corner',
      pickupSeconds: 70,
      destination: 'meskel',
      direction: 'forward' as const,
    },
    {
      id: 'eden',
      name: 'Eden T.',
      initials: 'ET',
      color: 'blue',
      pickup: 'Beside the bookshop',
      pickupSeconds: 80,
      destination: 'wollosefer',
      direction: 'forward' as const,
    },
    {
      id: 'nahom',
      name: 'Nahom G.',
      initials: 'NG',
      color: 'sand',
      pickup: 'Further down the road',
      pickupSeconds: 200,
      destination: 'meskel',
      direction: 'forward' as const,
    },
    {
      id: 'meron',
      name: 'Meron H.',
      initials: 'MH',
      color: 'pink',
      pickup: 'Across the median',
      pickupSeconds: 55,
      destination: 'meskel',
      direction: 'reverse' as const,
    },
  ].map((r) => ({ ...r, readyUntil: now + 120000, locationAt: now, optedIn: true }));
}
export function seedPool(now = Date.now()): PoolState {
  return {
    id: randomUUID(),
    version: 1,
    destination: 'meskel',
    zoneId: 'edna',
    locationSource: 'demo',
    riders: demoRiders(now),
    selectedIds: [],
    skippedIds: [],
    targetSeats: 4,
    status: 'draft',
    history: [
      {
        id: 'demo-history-1',
        route: 'Edna Mall → Meskel Square',
        members: 3,
        fare: 120,
        date: new Date(now - 86400000).toISOString(),
        demo: true,
      },
      {
        id: 'demo-history-2',
        route: 'Atlas → Mexico',
        members: 4,
        fare: 105,
        date: new Date(now - 2 * 86400000).toISOString(),
        demo: true,
      },
    ],
  };
}
