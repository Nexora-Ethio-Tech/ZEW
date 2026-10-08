import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import type { Store } from '../../shared/store.js';
import { seedPool, type PoolState } from './model.js';
import {
  GroupError,
  acceptGroup,
  applyForGroup,
  addRider,
  autoMatchGroup,
  fareQuote,
  newGroup,
  poolView,
  refreshDemo,
  requestGroup,
  requireDraft,
  setDeviceLocation,
  syncExpiry,
  setPlace,
  setTargetPreference,
  setGroupCriteria,
  groupDestinations,
} from './service.js';

export async function groupRoutes(app: FastifyInstance, { store }: { store: Store }) {
  const get = (sessionId: string) => {
    const pool = store.read(sessionId).pool;
    if (!pool) throw new GroupError('Open your group workspace first.', 404);
    return pool;
  };
  const mutate = (sessionId: string, event: string, change: (pool: PoolState) => void) =>
    store.mutate(sessionId, event, (state) => {
      if (!state.pool) throw new GroupError('Open your group workspace first.', 404);
      syncExpiry(state.pool);
      change(state.pool);
      return { value: poolView(state.pool), entityId: state.pool.id };
    });
  app.post('/pool/bootstrap', async (req) => {
    const existing = store.read(req.sessionId).pool;
    if (existing) {
      syncExpiry(existing);
      return store.mutate(req.sessionId, 'group.opened', (state) => {
        state.pool = existing;
        return { value: poolView(existing), entityId: existing.id };
      });
    }
    return store.mutate(req.sessionId, 'group.created', (state) => {
      state.pool = seedPool();
      return { value: poolView(state.pool), entityId: state.pool.id };
    });
  });
  app.get('/pool', async (req) => {
    const pool = get(req.sessionId),
      oldVersion = pool.version;
    syncExpiry(pool);
    if (oldVersion !== pool.version)
      return store.mutate(req.sessionId, 'group.availability_changed', (state) => {
        state.pool = pool;
        return { value: poolView(pool), entityId: pool.id };
      });
    return poolView(pool);
  });
  app.post('/pool/location', async (req) => {
    const input = z
      .discriminatedUnion('source', [
        z.object({ source: z.literal('demo'), zoneId: z.enum(['edna', 'atlas']) }).strict(),
        z
          .object({
            source: z.literal('device'),
            latitude: z.number().finite().min(-90).max(90),
            longitude: z.number().finite().min(-180).max(180),
            accuracy: z.number().finite().min(0).max(100000),
            timestamp: z.number().int().positive(),
          })
          .strict(),
      ])
      .parse(req.body);
    return mutate(req.sessionId, 'group.pickup_updated', (pool) => {
      requireDraft(pool);
      if (input.source === 'device') {
        const { source: _, ...location } = input;
        setDeviceLocation(pool, location);
      } else {
        pool.pickupPlace = undefined;
        pool.locationSource = 'demo';
        pool.location = undefined;
        pool.zoneId = input.zoneId;
        pool.selectedIds = [];
        pool.skippedIds = [];
        refreshDemo(pool);
      }
    });
  });
  app.post('/pool/destination', async (req) => {
    const { destination } = z
      .object({ destination: z.enum(['wollosefer', 'meskel', 'mexico']) })
      .strict()
      .parse(req.body);
    return mutate(req.sessionId, 'group.destination_updated', (pool) => {
      requireDraft(pool);
      pool.destination = destination;
      pool.destinationPlace = undefined;
      pool.selectedIds = [];
      refreshDemo(pool);
    });
  });
  app.post('/pool/place', async (req) => {
    const { target, place } = z
      .object({
        target: z.enum(['pickup', 'destination']),
        place: z
          .object({
            name: z.string().trim().min(1).max(300),
            latitude: z.number().finite().min(-90).max(90),
            longitude: z.number().finite().min(-180).max(180),
          })
          .strict(),
      })
      .strict()
      .parse(req.body);
    return mutate(req.sessionId, 'group.place_updated', (pool) => setPlace(pool, target, place));
  });
  app.post('/pool/members', async (req) => {
    const { riderId, action } = z
      .object({ riderId: z.string().min(1).max(40), action: z.enum(['add', 'remove', 'skip']) })
      .strict()
      .parse(req.body);
    return mutate(req.sessionId, `group.member_${action}`, (pool) => {
      requireDraft(pool);
      if (!pool.riders.some((r) => r.id === riderId)) throw new GroupError('Rider not found.', 404);
      if (action === 'add') addRider(pool, riderId);
      else {
        pool.selectedIds = pool.selectedIds.filter((id) => id !== riderId);
        if (action === 'skip' && !pool.skippedIds.includes(riderId)) pool.skippedIds.push(riderId);
        pool.version++;
      }
    });
  });
  app.post('/pool/preference', async (req) => {
    const { targetSeats } = z
      .object({ targetSeats: z.number().int().min(1).max(4) })
      .strict()
      .parse(req.body);
    return mutate(req.sessionId, 'group.preference_set', (pool) =>
      setTargetPreference(pool, targetSeats),
    );
  });
  app.post('/pool/auto-match', async (req) => {
    const input = z
      .object({
        minSeats: z.number().int().min(1).max(4).optional(),
        maxSeats: z.number().int().min(1).max(4).optional(),
        targetSeats: z.number().int().min(1).max(4).optional(),
        maxFare: z.number().positive().optional(),
      })
      .strict()
      .parse(req.body ?? {});
    return mutate(req.sessionId, 'group.auto_matched', (pool) => {
      autoMatchGroup(pool, input);
    });
  });
  app.post('/pool/refresh', async (req) =>
    mutate(req.sessionId, 'group.demo_availability_refreshed', refreshDemo),
  );
  app.post('/pool/request', async (req) => {
    const { version } = z.object({ version: z.number().int().positive() }).strict().parse(req.body);
    return mutate(req.sessionId, 'group.requested', (pool) => requestGroup(pool, version));
  });
  app.post('/pool/apply', async (req) => {
    const input = z.object({
      version: z.number().int().positive(),
      minSeats: z.number().int().positive().safe().optional(),
      maxSeats: z.number().int().positive().safe().optional(),
      maxFare: z.number().finite().positive().optional(),
    }).strict().parse(req.body);
    return mutate(req.sessionId, 'group.applied', (pool) => {
      if (pool.version !== input.version) throw new GroupError('Your journey changed. Review it and apply again.');
      if (input.minSeats !== undefined && input.maxSeats !== undefined && input.maxFare !== undefined) {
        setGroupCriteria(pool, { minSeats: input.minSeats, maxSeats: input.maxSeats, maxFare: input.maxFare });
      } else if (input.minSeats !== undefined || input.maxSeats !== undefined || input.maxFare !== undefined) {
        throw new GroupError('Provide all group and fare limits together.', 400);
      }
      applyForGroup(pool, pool.version);
    });
  });
  app.post('/pool/criteria', async (req) => {
    const input = z.object({
      version: z.number().int().positive(),
      minSeats: z.number().int().positive().safe(),
      maxSeats: z.number().int().positive().safe(),
      maxFare: z.number().finite().positive(),
    }).strict().parse(req.body);
    return mutate(req.sessionId, 'group.criteria_updated', (pool) => {
      if (pool.version !== input.version) throw new GroupError('Your journey changed. Review your preferences and try again.');
      setGroupCriteria(pool, input);
    });
  });
  app.post('/pool/accept', async (req) => {
    const { groupId, driverId } = z
      .object({ groupId: z.string().uuid(), driverId: z.enum(['hana', 'dawit', 'abel']) })
      .strict()
      .parse(req.body);
    return mutate(req.sessionId, 'group.accepted', (pool) => {
      if (pool.id !== groupId) throw new GroupError('This request has been replaced.');
      acceptGroup(pool, driverId);
    });
  });
  app.post('/pool/action', async (req) => {
    const { action } = z
      .object({ action: z.enum(['cancel', 'start', 'complete', 'new']) })
      .strict()
      .parse(req.body);
    return mutate(req.sessionId, `group.${action}`, (pool) => {
      if (action === 'new') {
        newGroup(pool);
        return;
      }
      if (action === 'cancel' && ['draft', 'requested', 'accepted'].includes(pool.status))
        pool.status = 'cancelled';
      else if (action === 'start' && pool.status === 'accepted') pool.status = 'in_progress';
      else if (action === 'complete' && pool.status === 'in_progress') {
        pool.status = 'completed';
        const quote = fareQuote(pool);
        pool.history.unshift({
          id: pool.id,
          route: `${poolView(pool).pickupName} → ${groupDestinations(pool).find((d) => d.id === pool.destination)!.name}`,
          members: 1 + pool.selectedIds.length,
          fare: pool.lockedFare ?? fareQuote(pool).yourFare,
          date: new Date().toISOString(),
          demo: true,
          driverId: pool.driverId,
          total: quote.total,
          fee: quote.fee,
          driverPayout: quote.driverPayout,
        });
        pool.history = pool.history.slice(0, 30);
      } else throw new GroupError('This action is not available for this group.');
      pool.version++;
    });
  });
}
