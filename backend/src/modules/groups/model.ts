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
// Schematic example pairs for this private demo. Coordinates identify approximate
// areas, not verified stops, road routes, or live passenger positions.
export const demoRoutePlaces = {
  edna: { name: 'Edna Mall, Bole', latitude: 8.9982, longitude: 38.7865 },
  atlas: { name: 'Atlas, Bole', latitude: 9.0035, longitude: 38.7798 },
  wollosefer: { name: 'Wollo Sefer', latitude: 8.9905, longitude: 38.7713 },
  meskel: { name: 'Meskel Square', latitude: 9.0108, longitude: 38.7615 },
  mexico: { name: 'Mexico Square', latitude: 9.0104, longitude: 38.7453 },
  gerji: { name: 'Gerji', latitude: 9.014, longitude: 38.807 },
  megenagna: { name: 'Megenagna', latitude: 9.029, longitude: 38.801 },
  cmc: { name: 'CMC', latitude: 9.042, longitude: 38.839 },
  kazanchis: { name: 'Kazanchis', latitude: 9.02, longitude: 38.767 },
  piassa: { name: 'Piassa', latitude: 9.033, longitude: 38.752 },
  lideta: { name: 'Lideta', latitude: 9.014, longitude: 38.733 },
  sarbet: { name: 'Sarbet', latitude: 8.993, longitude: 38.731 },
  gotera: { name: 'Gotera', latitude: 8.976, longitude: 38.758 },
  torhailoch: { name: 'Tor Hailoch', latitude: 9.003, longitude: 38.707 },
  adamaStation: { name: 'Adama station area', latitude: 8.54, longitude: 39.27 },
  adamaUniversity: { name: 'Adama university area', latitude: 8.56, longitude: 39.29 },
} as const;
export const demoRoutes = [
  { id: 'edna-meskel', from: 'edna', to: 'meskel' },
  { id: 'edna-mexico', from: 'edna', to: 'mexico' },
  { id: 'atlas-wollosefer', from: 'atlas', to: 'wollosefer' },
  { id: 'gerji-megenagna', from: 'gerji', to: 'megenagna' },
  { id: 'megenagna-kazanchis', from: 'megenagna', to: 'kazanchis' },
  { id: 'cmc-megenagna', from: 'cmc', to: 'megenagna' },
  { id: 'wollosefer-mexico', from: 'wollosefer', to: 'mexico' },
  { id: 'meskel-mexico', from: 'meskel', to: 'mexico' },
  { id: 'piassa-kazanchis', from: 'piassa', to: 'kazanchis' },
  { id: 'lideta-sarbet', from: 'lideta', to: 'sarbet' },
  { id: 'gotera-meskel', from: 'gotera', to: 'meskel' },
  { id: 'torhailoch-mexico', from: 'torhailoch', to: 'mexico' },
  { id: 'adama-station-university', from: 'adamaStation', to: 'adamaUniversity' },
] as const;
export const DEMO_APPLICANTS_PER_ROUTE = 14;
// Dot totals are derived from seeded applications, then scattered around each
// area for display. They are not individual locations or live demand.
export const demoDemandZones = Object.entries(demoRoutePlaces).map(([id, place]) => ({
  id,
  name: place.name,
  latitude: place.latitude,
  longitude: place.longitude,
  pickupCount: demoRoutes.filter((route) => route.from === id).length * DEMO_APPLICANTS_PER_ROUTE,
  destinationCount: demoRoutes.filter((route) => route.to === id).length * DEMO_APPLICANTS_PER_ROUTE,
}));
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
  corridorId?: string;
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
  const legacy = [
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
      direction: 'reverse' as const,
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
    {
      id: 'nahom',
      name: 'Nahom G.',
      initials: 'NG',
      color: 'sand',
      phone: 'Simulated',
      pickup: 'Outside the demo pickup window',
      pickupSeconds: 150,
      destination: 'meskel',
      direction: 'forward' as const,
    },
  ].map((r) => ({ ...r, readyUntil: now + 120000, locationAt: now, optedIn: true }));
  const names = ['Mekdes', 'Abel', 'Liya', 'Samuel', 'Hana', 'Biruk', 'Rahel', 'Nahom', 'Selam', 'Yared', 'Tigist', 'Dawit', 'Saron', 'Kalkidan'];
  const colors = ['peach', 'lavender', 'blue', 'mint', 'sand', 'pink'];
  const applicants = demoRoutes.flatMap((route, routeIndex) =>
    Array.from({ length: DEMO_APPLICANTS_PER_ROUTE }, (_, index) => {
      const from = demoRoutePlaces[route.from];
      const name = names[(index + routeIndex * 3) % names.length];
      return {
        id: `${route.id}-${index + 1}`,
        name: `${name} ${String.fromCharCode(65 + (index + routeIndex) % 26)}.`,
        initials: `${name[0]}${String.fromCharCode(65 + (index + routeIndex) % 26)}`,
        color: colors[(index + routeIndex) % colors.length],
        pickup: `${from.name} demo area`,
        pickupSeconds: 25 + (index % 8) * 7,
        destination: 'custom',
        direction: 'forward' as const,
        readyUntil: now + 120000,
        locationAt: now,
        optedIn: true,
        corridorId: route.id,
      };
    }),
  );
  return [...legacy, ...applicants];
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
