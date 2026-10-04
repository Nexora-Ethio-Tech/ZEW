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
  issue: string | null;
  selected: boolean;
  yourFareIfAdded: number | null;
}
export interface PoolDriver {
  id: string;
  name: string;
  car: string;
  plate: string;
  seats: number;
  etaSeconds: number;
  direction: string;
  issue: string | null;
}
export interface Pool {
  id: string;
  version: number;
  mode: 'demo';
  serverNow: number;
  maxPickupSeconds: number;
  destination: string;
  zoneId: string | null;
  locationSource: 'demo' | 'device' | 'place';
  mapPickup: Place;
  mapDestination: Place;
  location?: { accuracy: number; timestamp: number };
  locationIssue: string | null;
  pickupName: string;
  riders: PoolRider[];
  selectedIds: string[];
  skippedIds: string[];
  status:
    'draft' | 'requested' | 'accepted' | 'in_progress' | 'completed' | 'cancelled' | 'expired';
  requestedUntil?: number;
  lockedFare?: number;
  driverId?: string;
  targetSeats: number;
  fareOptions: { seats: number; yourFare: number; issue: string | null }[];
  requestIssue: string | null;
  driverEarnings: { driverId: string; completedTrips: number; payout: number }[];
  destinations: { id: string; name: string; fare: number; order: number }[];
  pickupZones: { id: string; name: string }[];
  quote: {
    total: number;
    count: number;
    yourFare: number;
    otherFare: number;
    savings: number;
    fee: number;
    driverPayout: number;
    split: 'equal';
  };
  drivers: PoolDriver[];
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
export const money = (amount: number) =>
  amount.toLocaleString('en-ET', { maximumFractionDigits: 2 });
export const duration = (seconds: number) =>
  seconds < 60
    ? `${seconds} sec`
    : `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')} min`;
