import { AsyncLocalStorage } from 'node:async_hooks';
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import type { PoolClient } from 'pg';
import { postgresPool } from './postgres-pool.js';
import type { DataStore, QuoteSnapshot } from './data-store.js';
import { ApiError } from './http-error.js';
import { RateLimitError } from './rate-limits.js';
import { currentCommand } from './commands.js';
import {
  seedState,
  setPlannedCatalog,
  type State,
  type Trip,
  type Journey,
  type Booking,
} from '../modules/trips/model.js';
import { setGroupCatalog } from '../modules/groups/model.js';
import type { GroupCatalog } from '../modules/groups/catalog.js';
import type { PlannedCatalog } from '../modules/trips/catalog.js';
import type { DriverProfile, DispatchRequest } from '../modules/dispatch/model.js';
import { driverAction, type AssignedRow } from '../modules/dispatch/service.js';
import { postgresSeats, syncPostgresDispatch } from '../modules/dispatch/postgres.js';

export class PostgresStore implements DataStore {
  private pool;
  private scope = new AsyncLocalStorage<PoolClient>();
  private lastCleanup = 0;
  constructor(
    url: string,
    private schema = 'zew',
  ) {
    if (!/^zew(?:_[a-z0-9_]+)?$/.test(schema)) throw new Error('Invalid database schema.');
    this.pool = postgresPool(url);
    // A dropped idle connection must not crash an otherwise healthy function instance.
    this.pool.on('error', () => {});
  }
  query = async (sql: string, parameters: unknown[] = []) => {
    const text = sql.replace(/@([a-z_]+)/g, (_, table) => `"${this.schema}"."${table}"`);
    return (await (this.scope.getStore() ?? this.pool).query(text, parameters)).rows;
  };
  async initialize() {
    const [groups, planned] = await Promise.all([
      this.query('SELECT key,data FROM @group_catalog'),
      this.query('SELECT key,data FROM @planned_catalog'),
    ]);
    const group = Object.fromEntries(
      groups.map((row) => [row.key, row.data]),
    ) as unknown as GroupCatalog;
    const trips = Object.fromEntries(
      planned.map((row) => [row.key, row.data]),
    ) as unknown as PlannedCatalog;
    if (!group.routes?.length || !group.riders?.length || !trips.trips?.length)
      throw new Error('Run the Postgres data migration before starting Zew.');
    setGroupCatalog(group);
    setPlannedCatalog(trips);
  }
  private async transaction<T>(run: () => Promise<T>): Promise<T> {
    if (this.scope.getStore()) return run();
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      // Database lock preserves the SQLite writer semantics across independent Vercel instances.
      // The preview uses one dispatch target. This can be partitioned by fleet as it expands.
      await client.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))', [
        this.schema + ':workspace-writes',
      ]);
      const result = await this.scope.run(client, run);
      await client.query('COMMIT');
      return result;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }
  private hash(value: string) {
    return createHash('sha256').update(value).digest('hex');
  }
  private async newSession(workspaceId: string) {
    const token = randomBytes(32).toString('hex');
    await this.query(
      'INSERT INTO @sessions(id,token_hash,state,expires_at,workspace_id) VALUES($1,$2,$3,$4,$5)',
      [randomUUID(), this.hash(token), '{}', Date.now() + 30 * 86400000, workspaceId],
    );
    return { token };
  }
  async create() {
    return this.transaction(async () => {
      const id = randomUUID();
      await this.query('INSERT INTO @workspaces VALUES($1,$2)', [id, JSON.stringify(seedState())]);
      return this.newSession(id);
    });
  }
  async createSessionForUser(identity: { id: string; email: string; name: string }) {
    return this.transaction(async () => {
      const email = identity.email.trim().toLowerCase();
      await this.query(
        'UPDATE @driver_access SET user_id=$1 WHERE lower(email)=$2 AND user_id IS NULL AND active=1',
        [identity.id, email],
      );
      let [account] = await this.query('SELECT workspace_id FROM @accounts WHERE id=$1', [
        identity.id,
      ]);
      if (!account) {
        const workspaceId = randomUUID();
        await this.query('INSERT INTO @workspaces VALUES($1,$2)', [
          workspaceId,
          JSON.stringify(seedState()),
        ]);
        await this.query('INSERT INTO @accounts VALUES($1,$2,$3,$4)', [
          identity.id,
          email,
          identity.name,
          workspaceId,
        ]);
        account = { workspace_id: workspaceId };
      } else
        await this.query('UPDATE @accounts SET email=$1,name=$2 WHERE id=$3', [
          email,
          identity.name,
          identity.id,
        ]);
      const user = (await this.readWorkspace(account.workspace_id)).user!;
      const session = await this.newSession(account.workspace_id);
      await this.event(account.workspace_id, 'auth.login', user.id);
      return { ...session, user };
    });
  }
  async session(token: string): Promise<string | undefined> {
    return (
      await this.query('SELECT id FROM @sessions WHERE token_hash=$1 AND expires_at>$2', [
        this.hash(token),
        Date.now(),
      ])
    )[0]?.id;
  }
  private async workspace(sessionId: string): Promise<string> {
    const [row] = await this.query(
      'SELECT workspace_id FROM @sessions WHERE id=$1 AND expires_at>$2',
      [sessionId, Date.now()],
    );
    if (!row) throw new ApiError(401, 'Your session has expired. Sign in again.');
    return row.workspace_id;
  }
  private async readWorkspace(id: string): Promise<State> {
    const [row] = await this.query(
      `SELECT w.state,a.id,a.email,a.name,EXISTS(SELECT 1 FROM @driver_access d WHERE d.user_id=a.id AND d.active=1) AS driver
      FROM @workspaces w LEFT JOIN @accounts a ON a.workspace_id=w.id WHERE w.id=$1`,
      [id],
    );
    if (!row) throw new ApiError(404, 'Workspace not found');
    const state = row.state as State;
    delete state.user;
    if (row.id)
      state.user = {
        id: row.id,
        email: row.email,
        name: row.name,
        role: row.driver ? 'driver' : 'rider',
      };
    return state;
  }
  async read(sessionId: string) {
    return this.readWorkspace(await this.workspace(sessionId));
  }
  private async event(workspaceId: string, kind: string, entityId: string) {
    await this.query('INSERT INTO @events VALUES($1,$2,$3,$4,$5)', [
      randomUUID(),
      workspaceId,
      kind,
      entityId,
      new Date().toISOString(),
    ]);
  }
  private async save(workspaceId: string, state: State, kind: string, entityId: string) {
    await syncPostgresDispatch(this.query, workspaceId, state);
    await this.query('UPDATE @workspaces SET state=$1 WHERE id=$2', [
      JSON.stringify(state),
      workspaceId,
    ]);
    await this.event(workspaceId, kind, entityId);
  }
  private async command<T>(workspaceId: string, run: () => Promise<T>): Promise<T> {
    const context = currentCommand();
    if (!context) return run();
    const [prior] = await this.query(
      'SELECT fingerprint,result FROM @mutation_receipts WHERE workspace_id=$1 AND key=$2',
      [workspaceId, context.key],
    );
    if (prior) {
      if (prior.fingerprint !== context.fingerprint)
        throw new ApiError(409, 'This retry key was already used for a different request.');
      return prior.result;
    }
    const value = await run();
    await this.query('INSERT INTO @mutation_receipts VALUES($1,$2,$3,$4,$5)', [
      workspaceId,
      context.key,
      context.fingerprint,
      JSON.stringify(value),
      Date.now(),
    ]);
    return value;
  }
  async mutate<T>(
    sessionId: string,
    kind: string,
    change: (state: State) => { value: T; entityId: string },
  ): Promise<T> {
    return this.transaction(async () => {
      const workspaceId = await this.workspace(sessionId);
      return this.command(workspaceId, async () => {
        const state = await this.readWorkspace(workspaceId);
        const { value, entityId } = change(state);
        await this.save(workspaceId, state, kind, entityId);
        return value;
      });
    });
  }
  async driver(sessionId: string): Promise<DriverProfile> {
    const workspaceId = await this.workspace(sessionId);
    const [row] = await this.query(
      'SELECT d.id,d.name,d.vehicle,d.seats FROM @driver_access d JOIN @accounts a ON a.id=d.user_id WHERE a.workspace_id=$1 AND d.active=1',
      [workspaceId],
    );
    if (!row) throw new ApiError(403, 'An approved driver account is required.');
    return row as DriverProfile;
  }
  async dispatchDriver(): Promise<DriverProfile | undefined> {
    return (
      await this.query(
        'SELECT d.id,d.name,d.vehicle,d.seats FROM @driver_access d JOIN @dispatch_settings s ON s.test_driver_id=d.id WHERE d.active=1 AND s.id=1',
      )
    )[0] as DriverProfile | undefined;
  }
  async listAssigned(sessionId: string): Promise<DispatchRequest[]> {
    const driver = await this.driver(sessionId);
    return (
      await this.query(
        'SELECT data,updated_at,departure_id FROM @dispatch_requests WHERE driver_id=$1 ORDER BY created_at DESC',
        [driver.id],
      )
    ).map((row) => ({
      ...row.data,
      ...(row.departure_id ? { departureId: row.departure_id } : {}),
      updatedAt: row.updated_at,
    }));
  }
  async mutateAssigned<T>(
    sessionId: string,
    requestId: string,
    action: string,
    change: (state: State, request: AssignedRow) => T,
  ): Promise<T> {
    return this.transaction(async () => {
      const driver = await this.driver(sessionId);
      const [row] = await this.query(
        'SELECT * FROM @dispatch_requests WHERE id=$1 AND driver_id=$2',
        [requestId, driver.id],
      );
      if (!row) throw new ApiError(404, 'Request not found');
      return this.command(await this.workspace(sessionId), async () => {
        if (action === 'accept') {
          if (row.departure_id) {
            const [departure] = await this.query(
              'SELECT status FROM @planned_departures WHERE id=$1',
              [row.departure_id],
            );
            if (!departure || !['open', 'boarding'].includes(departure.status))
              throw new ApiError(409, 'This departure has already started.');
          }
          const conflicts = await this.query(
            `SELECT id FROM @dispatch_requests WHERE driver_id=$1 AND id!=$2 AND
            (status='in_progress' OR (status='accepted' AND (kind='planned' OR (data->>'requestedUntil')::bigint>$3)))
            AND ($4::text IS NULL OR departure_id IS NULL OR departure_id!=$4 OR status='in_progress')`,
            [driver.id, requestId, Date.now(), row.departure_id],
          );
          if (conflicts.length)
            throw new ApiError(409, 'Finish your active ride before accepting another request.');
        }
        const state = await this.readWorkspace(row.workspace_id);
        const value = change(state, row as AssignedRow);
        await this.save(row.workspace_id, state, 'driver.' + action, requestId);
        if (row.departure_id && (action === 'start' || action === 'complete'))
          await this.coordinate(row.departure_id, action);
        await this.query('INSERT INTO @dispatch_events VALUES($1,$2,$3,$4,$5)', [
          randomUUID(),
          requestId,
          (await this.read(sessionId)).user!.id,
          action,
          new Date().toISOString(),
        ]);
        return value;
      });
    });
  }
  private async coordinate(departureId: string, action: 'start' | 'complete', required = false) {
    const rows = await this.query(
      "SELECT * FROM @dispatch_requests WHERE departure_id=$1 AND status IN('requested','accepted','in_progress')",
      [departureId],
    );
    if (action === 'start') {
      let ready = rows.length > 0;
      for (const row of rows)
        if (
          row.status !== 'accepted' ||
          !(await this.readWorkspace(row.workspace_id)).bookings.find((b) => b.id === row.id)
            ?.boardingVerified
        )
          ready = false;
      if (!ready) {
        if (required)
          throw new ApiError(
            409,
            'Accept or decline all requests and confirm each passenger’s boarding code first.',
          );
        return;
      }
    }
    for (const row of rows) {
      if (action === 'complete' && row.status !== 'in_progress')
        throw new ApiError(
          409,
          'This departure contains an unresolved reservation. Contact the operator.',
        );
      const state = await this.readWorkspace(row.workspace_id),
        booking = state.bookings.find((b) => b.id === row.id);
      if (!booking) throw new ApiError(409, 'Reservation needs operator review.');
      booking.status = action === 'start' ? 'in_progress' : 'completed';
      if (action === 'complete') booking.payment = 'simulated';
      await this.save(row.workspace_id, state, 'departure.' + action, row.id);
    }
    await this.query('UPDATE @planned_departures SET status=$1 WHERE id=$2', [
      action === 'start' ? 'in_progress' : 'completed',
      departureId,
    ]);
  }
  async performDriverAction(sessionId: string, requestId: string, action: string, code?: string) {
    const driver = await this.driver(sessionId),
      subject = this.hash('boarding:' + driver.id + ':' + requestId);
    if (
      !(
        await this.query('SELECT id FROM @dispatch_requests WHERE id=$1 AND driver_id=$2', [
          requestId,
          driver.id,
        ])
      ).length
    )
      throw new ApiError(404, 'Request not found');
    // Reserve an attempt atomically before changing trip state, so rollbacks cannot reset guesses.
    if (action === 'start') await this.takeLimit(subject, 5, 15 * 60000);
    try {
      const result = await this.mutateAssigned(sessionId, requestId, action, (state, row) =>
        driverAction(state, row, action, code),
      );
      if (action === 'start')
        await this.query('DELETE FROM @rate_limits WHERE subject=$1', [subject]);
      return result;
    } catch (error) {
      throw error;
    }
  }
  async startDeparture(sessionId: string, departureId: string) {
    return this.transaction(async () => {
      const driver = await this.driver(sessionId),
        [departure] = await this.query(
          'SELECT status FROM @planned_departures WHERE id=$1 AND driver_id=$2',
          [departureId, driver.id],
        );
      if (!departure) throw new ApiError(404, 'Departure not found');
      return this.command(await this.workspace(sessionId), async () => {
        if (departure.status !== 'boarding')
          throw new ApiError(409, 'This departure is not boarding.');
        await this.coordinate(departureId, 'start', true);
        await this.event(await this.workspace(sessionId), 'driver.departure.start', departureId);
        return { ok: true };
      });
    });
  }
  async earnings(sessionId: string) {
    const driver = await this.driver(sessionId),
      [row] = await this.query(
        'SELECT COUNT(DISTINCT COALESCE(departure_id,request_id)) AS completed,COALESCE(SUM(payout_minor),0) AS payout FROM @preview_settlements WHERE driver_id=$1',
        [driver.id],
      );
    return { completed: Number(row.completed), payout: Number(row.payout) / 100, simulated: true };
  }
  private async takeLimit(subject: string, maximum: number, windowMs: number) {
    const now = Date.now();
    const [row] = await this.query(
      `INSERT INTO @rate_limits VALUES($1,1,$2) ON CONFLICT(subject) DO UPDATE SET
      count=CASE WHEN @rate_limits.expires_at<=$3 THEN 1 ELSE LEAST(@rate_limits.count+1,$4+1) END,
      expires_at=CASE WHEN @rate_limits.expires_at<=$3 THEN excluded.expires_at ELSE @rate_limits.expires_at END RETURNING count,expires_at`,
      [subject, now + windowMs, now, maximum],
    );
    if (Number(row.count) > maximum)
      throw new RateLimitError(Math.max(1, Math.ceil((Number(row.expires_at) - now) / 1000)));
  }
  async limitRequests(identity: string) {
    await this.takeLimit(this.hash('http:' + identity), 600, 60000);
    if (Date.now() - this.lastCleanup > 60000) {
      this.lastCleanup = Date.now();
      await this.query('DELETE FROM @rate_limits WHERE expires_at<=$1', [Date.now()]);
      await this.query('DELETE FROM @booking_quotes WHERE expires_at<=$1 AND booking_id IS NULL', [
        Date.now() - 86400000,
      ]);
    }
  }
  async limitActor(sessionId: string) {
    await this.takeLimit(this.hash('actor:' + (await this.workspace(sessionId))), 120, 60000);
  }
  async events(sessionId: string) {
    return this.query(
      'SELECT kind,entity_id AS "entityId",created_at AS "createdAt" FROM @events WHERE session_id=$1 ORDER BY created_at DESC,id DESC LIMIT 30',
      [await this.workspace(sessionId)],
    );
  }
  async issueQuote(sessionId: string, journey: Journey, trip: Trip) {
    return this.transaction(async () => {
      const driver = await this.dispatchDriver();
      if (!driver || (await this.availableSeats(trip)) < journey.seats)
        throw new ApiError(409, 'There are no longer enough seats for this departure.');
      const id = randomUUID(),
        expires = Date.now() + 5 * 60000;
      await this.query('INSERT INTO @booking_quotes VALUES($1,$2,$3,$4,NULL)', [
        id,
        await this.workspace(sessionId),
        JSON.stringify({ journey, trip, driverId: driver.id }),
        expires,
      ]);
      return { quoteId: id, quoteExpiresAt: new Date(expires).toISOString() };
    });
  }
  async reserveQuoted(
    sessionId: string,
    quoteId: string,
    change: (state: State, quote: QuoteSnapshot) => { value: Booking; entityId: string },
  ) {
    return this.transaction(async () => {
      const workspaceId = await this.workspace(sessionId);
      return this.command(workspaceId, async () => {
        const [row] = await this.query(
          'SELECT * FROM @booking_quotes WHERE id=$1 AND workspace_id=$2',
          [quoteId, workspaceId],
        );
        if (!row) throw new ApiError(404, 'Quote not found. Search for a ride again.');
        if (!row.booking_id && Number(row.expires_at) <= Date.now())
          throw new ApiError(409, 'This quote expired. Search again to review the current fare.');
        if (!row.booking_id && row.snapshot.driverId !== (await this.dispatchDriver())?.id)
          throw new ApiError(409, 'The assigned driver changed. Search again to review this ride.');
        const state = await this.readWorkspace(workspaceId),
          { value, entityId } = change(state, { ...row.snapshot, bookingId: row.booking_id });
        if (!row.booking_id)
          await this.query('UPDATE @booking_quotes SET booking_id=$1 WHERE id=$2', [
            entityId,
            quoteId,
          ]);
        await this.save(workspaceId, state, 'booking.confirmed', entityId);
        return value;
      });
    });
  }
  async availableSeats(trip: Trip) {
    return postgresSeats(this.query, trip);
  }
  async revoke(token: string) {
    await this.query('DELETE FROM @sessions WHERE token_hash=$1', [this.hash(token)]);
  }
  async metric(route: string, status: number, elapsed: number) {
    await this.query(
      `INSERT INTO @request_metrics VALUES($1,$2,$3,1,$4) ON CONFLICT(minute,route,status)
    DO UPDATE SET count=@request_metrics.count+1,duration_ms=@request_metrics.duration_ms+excluded.duration_ms`,
      [Math.floor(Date.now() / 60000), route, status, elapsed],
    );
  }
  async ready() {
    return (await this.query('SELECT 1 AS ready'))[0].ready === 1;
  }
  async close() {
    await this.pool.end();
  }
}
