import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { seedState, type State } from '../modules/trips/model.js';

export class Store {
  private db: DatabaseSync;
  constructor(path: string) {
    if (path !== ':memory:') mkdirSync(dirname(path), { recursive: true });
    this.db = new DatabaseSync(path);
    this.db.exec(`PRAGMA journal_mode=WAL;
      CREATE TABLE IF NOT EXISTS sessions (id TEXT PRIMARY KEY, token_hash TEXT UNIQUE NOT NULL, state TEXT NOT NULL, expires_at INTEGER NOT NULL);
      CREATE TABLE IF NOT EXISTS events (id TEXT PRIMARY KEY, session_id TEXT NOT NULL, kind TEXT NOT NULL, entity_id TEXT NOT NULL, created_at TEXT NOT NULL);`);
  }
  create() {
    const token = randomBytes(32).toString('hex'),
      id = randomUUID();
    this.db
      .prepare('INSERT INTO sessions VALUES (?, ?, ?, ?)')
      .run(id, this.hash(token), JSON.stringify(seedState()), Date.now() + 30 * 86400000);
    return { token };
  }
  private hash(token: string) {
    return createHash('sha256').update(token).digest('hex');
  }
  session(token: string) {
    return this.db
      .prepare('SELECT id FROM sessions WHERE token_hash = ? AND expires_at > ?')
      .get(this.hash(token), Date.now())?.id as string | undefined;
  }
  read(id: string): State {
    const row = this.db.prepare('SELECT state FROM sessions WHERE id = ?').get(id);
    if (!row) throw new Error('Session not found');
    return JSON.parse(row.state as string) as State;
  }
  mutate<T>(id: string, kind: string, change: (state: State) => { value: T; entityId: string }): T {
    this.db.exec('BEGIN IMMEDIATE');
    try {
      const state = this.read(id);
      const { value, entityId } = change(state);
      this.db.prepare('UPDATE sessions SET state = ? WHERE id = ?').run(JSON.stringify(state), id);
      this.db
        .prepare('INSERT INTO events VALUES (?, ?, ?, ?, ?)')
        .run(randomUUID(), id, kind, entityId, new Date().toISOString());
      this.db.exec('COMMIT');
      return value;
    } catch (error) {
      this.db.exec('ROLLBACK');
      throw error;
    }
  }
  events(id: string) {
    return this.db
      .prepare(
        'SELECT kind, entity_id AS entityId, created_at AS createdAt FROM events WHERE session_id = ? ORDER BY rowid DESC LIMIT 30',
      )
      .all(id);
  }
  close() {
    this.db.close();
  }
}
