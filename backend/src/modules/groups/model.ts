import { randomUUID } from 'node:crypto';
import type { DatabaseSync } from 'node:sqlite';
import { initialGroupCatalog, loadGroupCatalog, type GroupCatalog } from './catalog.js';

export const MAX_PICKUP_SECONDS = 120;
export const MAX_LOCATION_AGE_MS = 120_000;
export const MAX_MEMBERS = 4;
let groupCatalog = initialGroupCatalog;
export let pickupZones = groupCatalog.pickupZones;
export let destinations = groupCatalog.destinations;
export let demoRoutePlaces = groupCatalog.routePlaces;
export let demoRoutes = groupCatalog.routes;
export let demoDrivers = groupCatalog.drivers;
export let customFare = groupCatalog.customFare;
export let DEMO_APPLICANTS_PER_ROUTE = groupCatalog.riders.filter(
  (r) => r.corridorId === groupCatalog.routes[0].id,
).length;
export let demoDemandZones = demandZones(groupCatalog);

function demandZones(source: GroupCatalog) {
  return Object.entries(source.routePlaces).map(([id, place]) => ({
    id,
    name: place.name,
    latitude: place.latitude,
    longitude: place.longitude,
    pickupCount: source.riders.filter((r) =>
      source.routes.some((route) => route.id === r.corridorId && route.from === id),
    ).length,
    destinationCount: source.riders.filter((r) =>
      source.routes.some((route) => route.id === r.corridorId && route.to === id),
    ).length,
  }));
}

export function activateGroupCatalog(db: DatabaseSync) {
  setGroupCatalog(loadGroupCatalog(db));
}
export function setGroupCatalog(catalog: GroupCatalog) {
  groupCatalog = catalog;
  pickupZones = groupCatalog.pickupZones;
  destinations = groupCatalog.destinations;
  demoRoutePlaces = groupCatalog.routePlaces;
  demoRoutes = groupCatalog.routes;
  demoDrivers = groupCatalog.drivers;
  customFare = groupCatalog.customFare;
  DEMO_APPLICANTS_PER_ROUTE = groupCatalog.riders.filter(
    (r) => r.corridorId === groupCatalog.routes[0].id,
  ).length;
  demoDemandZones = demandZones(groupCatalog);
}
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
  assignedDriver?: { id: string; name: string; vehicle: string; seats: number };
  boardingCode?: string;
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
  return groupCatalog.riders.map((rider) => ({
    ...rider,
    readyUntil: now + 120000,
    locationAt: now,
    optedIn: true,
  }));
}
export function seedPool(now = Date.now()): PoolState {
  return {
    id: randomUUID(),
    version: 1,
    destination: destinations[1]?.id ?? destinations[0].id,
    zoneId: pickupZones[0].id,
    locationSource: 'demo',
    riders: demoRiders(now),
    selectedIds: [],
    skippedIds: [],
    targetSeats: 1,
    status: 'draft',
    history: groupCatalog.history.map((ride, index) => ({
      ...ride,
      date: new Date(now - (index + 1) * 86400000).toISOString(),
    })),
  };
}
