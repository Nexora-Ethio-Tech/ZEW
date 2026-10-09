import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';
import type { PoolRider, PoolState, Place } from './model.js';

export interface GroupCatalog {
  pickupZones: (Place & { id: string })[];
  destinations: { id: string; name: string; fare: number; order: number }[];
  routePlaces: Record<string, Place>;
  routes: { id: string; from: string; to: string }[];
  drivers: {
    id: string; name: string; car: string; plate: string; phone: string;
    rating: number; seats: number; etaSeconds: number; direction: string;
  }[];
  riders: Omit<PoolRider, 'readyUntil' | 'locationAt' | 'optedIn'>[];
  history: Omit<PoolState['history'][number], 'date'>[];
  customFare: number;
}

export function loadGroupCatalog(db: DatabaseSync): GroupCatalog {
  const data = Object.fromEntries(
    (db.prepare('SELECT key, data FROM group_catalog').all() as { key: string; data: string }[])
      .map(({ key, data }) => [key, JSON.parse(data)]),
  ) as unknown as GroupCatalog;
  if (!data.pickupZones?.length || !data.destinations?.length || !data.routes?.length ||
      !data.drivers?.length || !data.riders?.length || !data.history?.length || !Number.isFinite(data.customFare)) {
    throw new Error('The group catalog is incomplete. Run database migrations.');
  }
  return data;
}

// Pure service tests use the same SQL catalog in an isolated in-memory database.
const testCatalogDb = new DatabaseSync(':memory:');
testCatalogDb.exec(readFileSync(new URL('../../../migrations/006_group_catalog.sql', import.meta.url), 'utf8'));
testCatalogDb.exec(readFileSync(new URL('../../../migrations/008_group_pricing.sql', import.meta.url), 'utf8'));
testCatalogDb.exec(readFileSync(new URL('../../../migrations/009_remove_placeholder_contacts.sql', import.meta.url), 'utf8'));
export const initialGroupCatalog = loadGroupCatalog(testCatalogDb);
testCatalogDb.close();
