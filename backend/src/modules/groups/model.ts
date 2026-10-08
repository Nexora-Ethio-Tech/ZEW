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
    phone: '+251 91 188 9012 (Simulated)',
    rating: 4.9,
    seats: 4,
    etaSeconds: 20,
    direction: 'forward',
  },
  {
    id: 'dawit',
    name: 'Dawit M.',
    car: 'Suzuki Dzire',
    plate: 'DEMO 3061',
    phone: '+251 91 299 3041 (Simulated)',
    rating: 4.8,
    seats: 3,
    etaSeconds: 45,
    direction: 'forward',
  },
  {
    id: 'abel',
    name: 'Abel K.',
    car: 'Toyota Yaris',
    plate: 'DEMO 1802',
    phone: '+251 91 377 4015 (Simulated)',
    rating: 4.95,
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
  phone?: string;
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
  minSeats?: number;
  maxSeats?: number;
  maxFare?: number;
  history: {
    id: string;
    route: string;
    members: number;
    fare: number;
    date: string;
    demo: true;
    driverId?: string;
    total?: number;
    fee?: number;
    driverPayout?: number;
  }[];
}
export function demoRiders(now = Date.now()): PoolRider[] {
  return [
    {
      id: 'sara',
      name: 'Sara M.',
      initials: 'SM',
      color: 'peach',
      phone: '+251 91 112 3456 (Simulated)',
      pickup: 'In front of the café near Edna Mall',
      pickupSeconds: 35,
      destination: 'meskel',
      direction: 'forward' as const,
    },
    {
      id: 'bereket',
      name: 'Bereket A.',
      initials: 'BA',
      color: 'lavender',
      phone: '+251 91 223 4567 (Simulated)',
      pickup: 'At Atlas hotel corner shelter',
      pickupSeconds: 50,
      destination: 'meskel',
      direction: 'forward' as const,
    },
    {
      id: 'eden',
      name: 'Eden T.',
      initials: 'ET',
      color: 'blue',
      phone: '+251 91 334 5678 (Simulated)',
      pickup: 'Beside the Wollo Sefer bookshop',
      pickupSeconds: 65,
      destination: 'wollosefer',
      direction: 'forward' as const,
    },
    {
      id: 'selam',
      name: 'Selam K.',
      initials: 'SK',
      color: 'mint',
      phone: '+251 91 445 6789 (Simulated)',
      pickup: 'Opposite Bole Medhanialem church gate',
      pickupSeconds: 40,
      destination: 'meskel',
      direction: 'forward' as const,
    },
    {
      id: 'henok',
      name: 'Henok F.',
      initials: 'HF',
      color: 'sand',
      phone: '+251 91 556 7890 (Simulated)',
      pickup: 'Near Kazanchis bus stop shelter',
      pickupSeconds: 75,
      destination: 'mexico',
      direction: 'forward' as const,
    },
    {
      id: 'tigist',
      name: 'Tigist D.',
      initials: 'TD',
      color: 'pink',
      phone: '+251 91 667 8901 (Simulated)',
      pickup: 'Beside Mexico square pharmacy',
      pickupSeconds: 90,
      destination: 'mexico',
      direction: 'forward' as const,
    },
    {
      id: 'yonas',
      name: 'Yonas M.',
      initials: 'YM',
      color: 'blue',
      phone: '+251 91 778 9012 (Simulated)',
      pickup: 'Just past the traffic light crossing',
      pickupSeconds: 15,
      destination: 'meskel',
      direction: 'forward' as const,
    },
    {
      id: 'kalkidan',
      name: 'Kalkidan S.',
      initials: 'KS',
      color: 'peach',
      phone: '+251 91 889 0123 (Simulated)',
      pickup: 'Near the Wollo Sefer taxi stand',
      pickupSeconds: 55,
      destination: 'wollosefer',
      direction: 'forward' as const,
    },
    {
      id: 'abel_w',
      name: 'Abel W.',
      initials: 'AW',
      color: 'mint',
      phone: '+251 91 990 1234 (Simulated)',
      pickup: 'Outside Harmony Hotel entrance',
      pickupSeconds: 30,
      destination: 'meskel',
      direction: 'forward' as const,
    },
    {
      id: 'meron',
      name: 'Meron G.',
      initials: 'MG',
      color: 'lavender',
      phone: '+251 92 001 2345 (Simulated)',
      pickup: 'Bole Brass zebra crossing shelter',
      pickupSeconds: 45,
      destination: 'wollosefer',
      direction: 'forward' as const,
    },
    {
      id: 'michael',
      name: 'Michael B.',
      initials: 'MB',
      color: 'sand',
      phone: '+251 92 112 3456 (Simulated)',
      pickup: 'Atlas Total gas station corner',
      pickupSeconds: 60,
      destination: 'mexico',
      direction: 'forward' as const,
    },
    {
      id: 'hiwot',
      name: 'Hiwot A.',
      initials: 'HA',
      color: 'pink',
      phone: '+251 92 223 4567 (Simulated)',
      pickup: 'Olympia traffic light shelter',
      pickupSeconds: 70,
      destination: 'meskel',
      direction: 'forward' as const,
    },
    {
      id: 'solomon',
      name: 'Solomon H.',
      initials: 'SH',
      color: 'peach',
      phone: '+251 92 334 5678 (Simulated)',
      pickup: 'Meskel Flower roundabout shelter',
      pickupSeconds: 80,
      destination: 'mexico',
      direction: 'forward' as const,
    },
    {
      id: 'bethlehem',
      name: 'Bethlehem T.',
      initials: 'BT',
      color: 'blue',
      phone: '+251 92 445 6789 (Simulated)',
      pickup: 'Dembel City Center main gate',
      pickupSeconds: 40,
      destination: 'wollosefer',
      direction: 'forward' as const,
    },
    {
      id: 'dawit_k',
      name: 'Dawit K.',
      initials: 'DK',
      color: 'mint',
      phone: '+251 92 556 7890 (Simulated)',
      pickup: 'Kazanchis Commercial Bank corner',
      pickupSeconds: 85,
      destination: 'mexico',
      direction: 'forward' as const,
    },
    {
      id: 'rahwa',
      name: 'Rahwa F.',
      initials: 'RF',
      color: 'lavender',
      phone: '+251 92 667 8901 (Simulated)',
      pickup: 'Gotera interchange pedestrian bridge',
      pickupSeconds: 95,
      destination: 'wollosefer',
      direction: 'forward' as const,
    },
  ].map((r) => ({ ...r, readyUntil: now + 180000, locationAt: now, optedIn: true }));
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
    targetSeats: 1,
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
