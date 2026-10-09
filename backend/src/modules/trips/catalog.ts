import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';
import type { Trip } from './model.js';

export interface PlannedCatalog {
  corridors: {
    id: string;
    name: string;
    stops: { id: string; name: string; area: string; latitude: number; longitude: number }[];
  }[];
  trips: (Omit<Trip, 'departure'> & { offsetMinutes: number })[];
}

export function loadPlannedCatalog(db: DatabaseSync): PlannedCatalog {
  const rows = db.prepare('SELECT key, data FROM planned_catalog').all() as { key: string; data: string }[];
  const catalog = Object.fromEntries(rows.map(({ key, data }) => [key, JSON.parse(data)])) as unknown as PlannedCatalog;
  if (!catalog.corridors?.length || !catalog.trips?.length)
    throw new Error('The planned journey catalog is incomplete. Run database migrations.');
  return catalog;
}

const testCatalogDb = new DatabaseSync(':memory:');
testCatalogDb.exec(readFileSync(new URL('../../../migrations/007_planned_catalog.sql', import.meta.url), 'utf8'));
export const initialPlannedCatalog = loadPlannedCatalog(testCatalogDb);
testCatalogDb.close();
