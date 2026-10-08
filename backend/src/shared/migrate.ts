import { DatabaseSync } from 'node:sqlite';
import { readdirSync, readFileSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { env } from '../config/env.js';

export function runMigrations(databasePath: string = env.DATABASE_PATH) {
  if (databasePath !== ':memory:') mkdirSync(dirname(databasePath), { recursive: true });
  const db = new DatabaseSync(databasePath);
  try {
    db.exec(
      'CREATE TABLE IF NOT EXISTS schema_migrations (name TEXT PRIMARY KEY, executed_at TEXT NOT NULL)',
    );
    const executed = new Set(
      (db.prepare('SELECT name FROM schema_migrations').all() as { name: string }[]).map(
        (r) => r.name,
      ),
    );
    const directory = new URL('../../migrations/', import.meta.url);
    for (const name of readdirSync(directory)
      .filter((f) => f.endsWith('.sql'))
      .sort()) {
      if (executed.has(name)) continue;
      db.exec('BEGIN IMMEDIATE');
      try {
        db.exec(readFileSync(new URL(name, directory), 'utf8'));
        db.prepare('INSERT INTO schema_migrations VALUES (?, ?)').run(
          name,
          new Date().toISOString(),
        );
        db.exec('COMMIT');
      } catch (error) {
        db.exec('ROLLBACK');
        throw error;
      }
    }
  } finally {
    db.close();
  }
}
if (process.argv[1]?.endsWith('migrate.ts') || process.argv[1]?.endsWith('migrate.js'))
  runMigrations();
