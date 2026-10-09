import type { DataStore, QuoteSnapshot } from './data-store.js';
import type { Booking } from '../modules/trips/model.js';
import { DatabaseSync } from 'node:sqlite';
import { mkdirSync, chmodSync } from 'node:fs';
import { dirname } from 'node:path';
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import {
  activatePlannedCatalog,
  seedState,
  type State,
  type Trip,
  type Journey,
} from '../modules/trips/model.js';
import { runMigrations } from './migrate.js';
import { activateGroupCatalog } from '../modules/groups/model.js';
import { syncDispatch, remainingSeats, type AssignedRow } from '../modules/dispatch/service.js';
import { executeCommand } from './commands.js';
import { checkLimit, recordAttempt, clearAttempts } from './rate-limits.js';
import { coordinateDeparture } from '../modules/dispatch/departures.js';
import { driverAction } from '../modules/dispatch/service.js';
import type { DriverProfile, DispatchRequest } from '../modules/dispatch/model.js';

class AccessError extends Error {
  constructor(
    public statusCode: number,
    message: string,
  ) {
    super(message);
  }
}
export class Store implements DataStore {
  private db: DatabaseSync;
  private lastCleanup = 0;
  constructor(path: string) {
    if (path !== ':memory:') mkdirSync(dirname(path), { recursive: true, mode: 0o700 });
    const previousMask = process.umask(0o077);
    try {
      this.db = new DatabaseSync(path);
      if (path !== ':memory:') chmodSync(path, 0o600);
    } finally {
      process.umask(previousMask);
    }
    this.db.exec('PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON; PRAGMA busy_timeout=5000');
    runMigrations(path, this.db);
    activateGroupCatalog(this.db);
    activatePlannedCatalog(this.db);
  }
  private transaction<T>(fn: () => T): T {
    this.db.exec('BEGIN IMMEDIATE');
    try {
      const value = fn();
      this.db.exec('COMMIT');
      return value;
    } catch (error) {
      this.db.exec('ROLLBACK');
      throw error;
    }
  }
  private newSession(workspaceId: string) {
    const token = randomBytes(32).toString('hex');
    this.db
      .prepare(
        'INSERT INTO sessions(id, token_hash, state, expires_at, workspace_id) VALUES (?, ?, ?, ?, ?)',
      )
      .run(randomUUID(), this.hash(token), '{}', Date.now() + 30 * 86400000, workspaceId);
    return { token };
  }
  create() {
    return this.transaction(() => {
      const id = randomUUID();
      this.db.prepare('INSERT INTO workspaces VALUES (?, ?)').run(id, JSON.stringify(seedState()));
      return this.newSession(id);
    });
  }
  createSessionForUser(identity: { id: string; email: string; name: string }) {
    return this.transaction(() => {
      const email = identity.email.trim().toLowerCase();
      // Only server-owned invitations bind a confirmed provider identity to a driver.
      this.db
        .prepare(
          'UPDATE driver_access SET user_id = ? WHERE email = ? COLLATE NOCASE AND user_id IS NULL AND active = 1',
        )
        .run(identity.id, email);
      let account = this.db
        .prepare('SELECT workspace_id FROM accounts WHERE id = ?')
        .get(identity.id);
      if (!account) {
        const workspaceId = randomUUID();
        this.db
          .prepare('INSERT INTO workspaces VALUES (?, ?)')
          .run(workspaceId, JSON.stringify(seedState()));
        this.db
          .prepare('INSERT INTO accounts VALUES (?, ?, ?, ?)')
          .run(identity.id, email, identity.name, workspaceId);
        account = { workspace_id: workspaceId };
      } else
        this.db
          .prepare('UPDATE accounts SET email = ?, name = ? WHERE id = ?')
          .run(email, identity.name, identity.id);
      const workspaceId = account.workspace_id as string;
      const user = this.readWorkspace(workspaceId).user!;
      const session = this.newSession(workspaceId);
      this.event(workspaceId, 'auth.login', user.id);
      return { ...session, user };
    });
  }
  private hash(token: string) {
    return createHash('sha256').update(token).digest('hex');
  }
  session(token: string) {
    return this.db
      .prepare('SELECT id FROM sessions WHERE token_hash = ? AND expires_at > ?')
      .get(this.hash(token), Date.now())?.id as string | undefined;
  }
  private workspace(id: string): string {
    const row = this.db
      .prepare('SELECT workspace_id FROM sessions WHERE id = ? AND expires_at > ?')
      .get(id, Date.now());
    if (!row) throw new AccessError(401, 'Your session has expired. Sign in again.');
    return row.workspace_id as string;
  }
  private readWorkspace(id: string): State {
    const row = this.db.prepare('SELECT state FROM workspaces WHERE id = ?').get(id);
    if (!row) throw new AccessError(404, 'Workspace not found');
    const state = JSON.parse(row.state as string) as State;
    const account = this.db
      .prepare('SELECT id, email, name FROM accounts WHERE workspace_id = ?')
      .get(id);
    delete state.user;
    if (account)
      state.user = {
        id: account.id as string,
        email: account.email as string,
        name: account.name as string,
        role: this.db
          .prepare('SELECT id FROM driver_access WHERE user_id = ? AND active = 1')
          .get(account.id)
          ? 'driver'
          : 'rider',
      };
    return state;
  }
  read(id: string): State {
    return this.readWorkspace(this.workspace(id));
  }
  private event(workspaceId: string, kind: string, entityId: string) {
    this.db
      .prepare('INSERT INTO events VALUES (?, ?, ?, ?, ?)')
      .run(randomUUID(), workspaceId, kind, entityId, new Date().toISOString());
  }
  private save(workspaceId: string, state: State, kind: string, entityId: string) {
    syncDispatch(this.db, workspaceId, state);
    this.db
      .prepare('UPDATE workspaces SET state = ? WHERE id = ?')
      .run(JSON.stringify(state), workspaceId);
    this.event(workspaceId, kind, entityId);
  }
  mutate<T>(id: string, kind: string, change: (state: State) => { value: T; entityId: string }): T {
    return this.transaction(() => {
      const workspaceId = this.workspace(id);
      return executeCommand(this.db, workspaceId, () => {
        const state = this.readWorkspace(workspaceId);
        const { value, entityId } = change(state);
        this.save(workspaceId, state, kind, entityId);
        return value;
      });
    });
  }
  driver(id: string): DriverProfile {
    const user = this.read(id).user;
    const row =
      user &&
      this.db
        .prepare(
          'SELECT id, name, vehicle, seats FROM driver_access WHERE user_id = ? AND active = 1',
        )
        .get(user.id);
    if (!row) throw new AccessError(403, 'An approved driver account is required.');
    return row as unknown as DriverProfile;
  }
  dispatchDriver(): DriverProfile | undefined {
    return this.db
      .prepare(
        'SELECT d.id, d.name, d.vehicle, d.seats FROM driver_access d JOIN dispatch_settings s ON s.test_driver_id = d.id WHERE d.active = 1 AND s.id = 1',
      )
      .get() as unknown as DriverProfile | undefined;
  }
  listAssigned(id: string): DispatchRequest[] {
    const driver = this.driver(id);
    return this.db
      .prepare(
        'SELECT data, updated_at, departure_id FROM dispatch_requests WHERE driver_id = ? ORDER BY created_at DESC',
      )
      .all(driver.id)
      .map((row) => ({
        ...JSON.parse(row.data as string),
        ...(row.departure_id ? { departureId: row.departure_id as string } : {}),
        updatedAt: row.updated_at as string,
      }));
  }
  mutateAssigned<T>(
    sessionId: string,
    requestId: string,
    action: string,
    change: (state: State, request: AssignedRow) => T,
  ): T {
    return this.transaction(() => {
      const driver = this.driver(sessionId);
      const row = this.db
        .prepare('SELECT * FROM dispatch_requests WHERE id = ? AND driver_id = ?')
        .get(requestId, driver.id) as unknown as AssignedRow | undefined;
      if (!row) throw new AccessError(404, 'Request not found');
      return executeCommand(this.db, this.workspace(sessionId), () => {
        if (action === 'accept' && row.departure_id) {
          const departure = this.db
            .prepare('SELECT status FROM planned_departures WHERE id=?')
            .get(row.departure_id);
          if (!departure || !['open', 'boarding'].includes(departure.status as string))
            throw new AccessError(409, 'This departure has already started.');
        }
        if (
          action === 'accept' &&
          this.db
            .prepare(
              "SELECT id FROM dispatch_requests WHERE driver_id = ? AND id != ? AND (status = 'in_progress' OR (status = 'accepted' AND (kind = 'planned' OR json_extract(data, '$.requestedUntil') > ?))) AND (? IS NULL OR departure_id IS NULL OR departure_id != ? OR status = 'in_progress')",
            )
            .get(driver.id, requestId, Date.now(), row.departure_id, row.departure_id)
        )
          throw new AccessError(409, 'Finish your active ride before accepting another request.');
        const state = this.readWorkspace(row.workspace_id);
        const value = change(state, row);
        this.save(row.workspace_id, state, 'driver.' + action, requestId);
        if (row.departure_id && (action === 'start' || action === 'complete'))
          coordinateDeparture(
            this.db,
            row.departure_id,
            action,
            (workspaceId) => this.readWorkspace(workspaceId),
            (workspaceId, state, kind, entityId) => this.save(workspaceId, state, kind, entityId),
          );
        this.db
          .prepare('INSERT INTO dispatch_events VALUES (?, ?, ?, ?, ?)')
          .run(
            randomUUID(),
            requestId,
            this.read(sessionId).user!.id,
            action,
            new Date().toISOString(),
          );
        return value;
      });
    });
  }
  performDriverAction(sessionId: string, requestId: string, action: string, code?: string) {
    const driver = this.driver(sessionId);
    const row = this.db
      .prepare('SELECT id FROM dispatch_requests WHERE id=? AND driver_id=?')
      .get(requestId, driver.id);
    if (!row) throw new AccessError(404, 'Request not found');
    const subject = driver.id + ':' + requestId;
    try {
      const result = this.mutateAssigned(sessionId, requestId, action, (state, request) => {
        if (action === 'start') checkLimit(this.db, 'boarding', subject, 5);
        return driverAction(state, request, action, code);
      });
      if (action === 'start') clearAttempts(this.db, 'boarding', subject);
      return result;
    } catch (error) {
      // Failed guesses survive the rolled-back trip transaction and API restarts.
      if (action === 'start' && (error as { statusCode?: number }).statusCode === 400)
        recordAttempt(this.db, 'boarding', subject, 15 * 60000);
      throw error;
    }
  }
  startDeparture(sessionId: string, departureId: string) {
    return this.transaction(() => {
      const driver = this.driver(sessionId);
      const departure = this.db
        .prepare('SELECT status FROM planned_departures WHERE id=? AND driver_id=?')
        .get(departureId, driver.id);
      if (!departure) throw new AccessError(404, 'Departure not found');
      return executeCommand(this.db, this.workspace(sessionId), () => {
        if (departure.status !== 'boarding')
          throw new AccessError(409, 'This departure is not boarding.');
        coordinateDeparture(
          this.db,
          departureId,
          'start',
          (workspaceId) => this.readWorkspace(workspaceId),
          (workspaceId, state, kind, entityId) => this.save(workspaceId, state, kind, entityId),
          true,
        );
        this.event(this.workspace(sessionId), 'driver.departure.start', departureId);
        return { ok: true };
      });
    });
  }
  earnings(sessionId: string) {
    const driver = this.driver(sessionId);
    const row = this.db
      .prepare(
        `SELECT COUNT(DISTINCT COALESCE(departure_id,request_id)) AS completed,
      COALESCE(SUM(payout_minor),0) AS payout FROM preview_settlements WHERE driver_id=?`,
      )
      .get(driver.id)!;
    return { completed: Number(row.completed), payout: Number(row.payout) / 100, simulated: true };
  }
  limitActor(sessionId: string) {
    this.limitRequests(this.workspace(sessionId), 'actor', 120);
  }
  limitRequests(identity: string, scope = 'http', maximum = 600) {
    // Trusted socket peer only. Never trust a caller-supplied forwarding header.
    this.transaction(() => {
      checkLimit(this.db, scope, identity, maximum);
      recordAttempt(this.db, scope, identity, 60000);
      if (Date.now() - this.lastCleanup > 60000) {
        this.db.prepare('DELETE FROM rate_limits WHERE expires_at <= ?').run(Date.now());
        this.db
          .prepare('DELETE FROM booking_quotes WHERE expires_at <= ? AND booking_id IS NULL')
          .run(Date.now() - 86400000);
        this.lastCleanup = Date.now();
      }
    });
  }
  events(id: string) {
    return this.db
      .prepare(
        'SELECT kind, entity_id AS entityId, created_at AS createdAt FROM events WHERE session_id = ? ORDER BY rowid DESC LIMIT 30',
      )
      .all(this.workspace(id));
  }
  issueQuote(sessionId: string, journey: Journey, trip: Trip) {
    return this.transaction(() => {
      const driver = this.dispatchDriver();
      if (!driver || this.availableSeats(trip) < journey.seats)
        throw new AccessError(409, 'There are no longer enough seats for this departure.');
      const id = randomUUID(),
        expiresAt = Date.now() + 5 * 60000;
      this.db
        .prepare('INSERT INTO booking_quotes VALUES (?,?,?,?,NULL)')
        .run(
          id,
          this.workspace(sessionId),
          JSON.stringify({ journey, trip, driverId: driver.id }),
          expiresAt,
        );
      return { quoteId: id, quoteExpiresAt: new Date(expiresAt).toISOString() };
    });
  }
  quote(sessionId: string, quoteId: string) {
    const row = this.db
      .prepare('SELECT * FROM booking_quotes WHERE id=? AND workspace_id=?')
      .get(quoteId, this.workspace(sessionId));
    if (!row) throw new AccessError(404, 'Quote not found. Search for a ride again.');
    const snapshot = JSON.parse(row.snapshot as string) as {
      journey: Journey;
      trip: Trip;
      driverId: string;
    };
    if (!row.booking_id && Number(row.expires_at) <= Date.now())
      throw new AccessError(409, 'This quote expired. Search again to review the current fare.');
    if (!row.booking_id && snapshot.driverId !== this.dispatchDriver()?.id)
      throw new AccessError(409, 'The assigned driver changed. Search again to review this ride.');
    return { ...snapshot, bookingId: row.booking_id as string | null };
  }
  reserveQuoted(
    sessionId: string,
    quoteId: string,
    change: (state: State, quote: QuoteSnapshot) => { value: Booking; entityId: string },
  ) {
    return this.mutate(sessionId, 'booking.confirmed', (state) => {
      const quote = this.quote(sessionId, quoteId);
      const result = change(state, quote);
      if (!quote.bookingId) this.consumeQuote(quoteId, result.entityId);
      return result;
    });
  }
  consumeQuote(quoteId: string, bookingId: string) {
    // Called only from reserve(), within the same transaction as inventory and dispatch.
    this.db
      .prepare('UPDATE booking_quotes SET booking_id=? WHERE id=? AND booking_id IS NULL')
      .run(bookingId, quoteId);
  }
  availableSeats(trip: Trip) {
    return remainingSeats(this.db, trip);
  }
  revoke(token: string) {
    this.db.prepare('DELETE FROM sessions WHERE token_hash = ?').run(this.hash(token));
  }
  metric(route: string, status: number, elapsed: number) {
    this.db
      .prepare(
        `INSERT INTO request_metrics VALUES (?,?,?,1,?) ON CONFLICT(minute,route,status)
      DO UPDATE SET count=count+1,duration_ms=duration_ms+excluded.duration_ms`,
      )
      .run(Math.floor(Date.now() / 60000), route, status, elapsed);
  }
  ready() {
    return this.db.prepare('SELECT 1 AS ready').get()!.ready === 1;
  }
  close() {
    this.db.close();
  }
}
