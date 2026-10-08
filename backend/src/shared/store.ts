import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { seedState, type State } from '../modules/trips/model.js';
import { supabase } from './supabase.js';
import { runMigrations } from './migrate.js';

export class Store {
  private db: DatabaseSync;
  constructor(path: string) {
    if (path !== ':memory:') {
      mkdirSync(dirname(path), { recursive: true });
      runMigrations(path);
    }
    this.db = new DatabaseSync(path);
    this.db.exec(`PRAGMA journal_mode=WAL;
      CREATE TABLE IF NOT EXISTS sessions (id TEXT PRIMARY KEY, token_hash TEXT UNIQUE NOT NULL, state TEXT NOT NULL, expires_at INTEGER NOT NULL);
      CREATE TABLE IF NOT EXISTS events (id TEXT PRIMARY KEY, session_id TEXT NOT NULL, kind TEXT NOT NULL, entity_id TEXT NOT NULL, created_at TEXT NOT NULL);`);
  }
  create() {
    const token = randomBytes(32).toString('hex'),
      id = randomUUID();
    const expiresAt = Date.now() + 30 * 86400000;
    const tokenHash = this.hash(token);
    const initialState = JSON.stringify(seedState());

    this.db
      .prepare('INSERT INTO sessions VALUES (?, ?, ?, ?)')
      .run(id, tokenHash, initialState, expiresAt);

    if (supabase) {
      void supabase.from('sessions').upsert({
        id,
        token_hash: tokenHash,
        state: initialState,
        expires_at: expiresAt,
      }).then(({ error }) => {
        if (error) console.error('[Supabase Sync Session Notice]:', error.message);
      });
    }

    return { token };
  }
  hashPassword(password: string) {
    return createHash('sha256').update(password).digest('hex');
  }

  findUserByEmail(email: string) {
    try {
      const row = this.db
        .prepare('SELECT id, email, name, password_hash AS passwordHash, role, created_at AS createdAt FROM users WHERE LOWER(email) = LOWER(?)')
        .get(email) as { id: string; email: string; name: string; passwordHash: string; role: string; createdAt: string } | undefined;
      return row;
    } catch {
      return undefined;
    }
  }

  createUser(input: { email: string; name: string; password: string; role?: string }) {
    const existing = this.findUserByEmail(input.email);
    if (existing) throw new Error('An account with this email already exists.');
    const id = `user-${randomUUID().slice(0, 8)}`;
    const passwordHash = this.hashPassword(input.password);
    const role = input.role || 'rider';
    const createdAt = new Date().toISOString();

    this.db
      .prepare('INSERT INTO users (id, email, name, password_hash, role, created_at) VALUES (?, ?, ?, ?, ?, ?)')
      .run(id, input.email.toLowerCase(), input.name, passwordHash, role, createdAt);

    return { id, email: input.email.toLowerCase(), name: input.name, role, createdAt };
  }

  createSessionForUser(user: { id: string; email: string; name: string; role: string }) {
    const res = this.create();
    const sessionId = this.session(res.token)!;
    this.mutate(sessionId, 'auth.login', (state) => {
      (state as any).user = user;
      return { value: true, entityId: user.id };
    });
    return { token: res.token, user };
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
      const updatedStateJson = JSON.stringify(state);
      const eventId = randomUUID();
      const createdAt = new Date().toISOString();

      this.db.prepare('UPDATE sessions SET state = ? WHERE id = ?').run(updatedStateJson, id);
      this.db
        .prepare('INSERT INTO events VALUES (?, ?, ?, ?, ?)')
        .run(eventId, id, kind, entityId, createdAt);
      this.db.exec('COMMIT');

      if (supabase) {
        void supabase.from('sessions').update({ state: updatedStateJson }).eq('id', id).then(({ error }) => {
          if (error) console.error('[Supabase Sync Mutate Notice]:', error.message);
        });
        void supabase.from('events').insert({
          id: eventId,
          session_id: id,
          kind,
          entity_id: entityId,
          created_at: createdAt,
        }).then(({ error }) => {
          if (error) console.error('[Supabase Sync Event Notice]:', error.message);
        });
      }

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
