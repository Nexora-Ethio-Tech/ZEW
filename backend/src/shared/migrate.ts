import { DatabaseSync } from 'node:sqlite';
import { readdirSync, readFileSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { env } from '../config/env.js';
import { supabase } from './supabase.js';

export function runMigrations(databasePath: string = env.DATABASE_PATH) {
  if (databasePath !== ':memory:') {
    mkdirSync(dirname(databasePath), { recursive: true });
  }

  const db = new DatabaseSync(databasePath);

  // Ensure migration tracking table exists
  db.exec(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      name TEXT PRIMARY KEY,
      executed_at TEXT NOT NULL
    );
  `);

  const executedRows = db.prepare('SELECT name FROM schema_migrations').all() as { name: string }[];
  const executed = new Set(executedRows.map((r) => r.name));

  const migrationsDir = join(process.cwd(), 'migrations');
  let migrationFiles: string[] = [];

  try {
    migrationFiles = readdirSync(migrationsDir)
      .filter((file) => file.endsWith('.sql'))
      .sort();
  } catch {
    console.warn('[Migrations]: No migrations directory found at', migrationsDir);
    return;
  }

  for (const file of migrationFiles) {
    if (executed.has(file)) {
      continue;
    }

    const filepath = join(migrationsDir, file);
    const sql = readFileSync(filepath, 'utf-8');

    db.exec('BEGIN IMMEDIATE');
    try {
      db.exec(sql);
      db.prepare('INSERT INTO schema_migrations VALUES (?, ?)').run(file, new Date().toISOString());
      db.exec('COMMIT');
      console.log(`[Migrations]: Successfully executed ${file}`);

      // Attempt optional Supabase sync for schema/seed tracking
      if (supabase) {
        void supabase.from('schema_migrations').upsert({
          name: file,
          executed_at: new Date().toISOString(),
        }).then(({ error }) => {
          if (error) {
            // Ignore schema warning if table doesn't exist on Supabase yet
          }
        });
      }
    } catch (error) {
      db.exec('ROLLBACK');
      console.error(`[Migrations]: Failed executing ${file}:`, error);
      throw error;
    }
  }

  db.close();
}

// Allow CLI execution via `npm run migrate`
if (process.argv[1]?.endsWith('migrate.ts') || process.argv[1]?.endsWith('migrate.js')) {
  runMigrations();
}
