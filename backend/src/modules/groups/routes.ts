import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import type { DataStore as Store } from '../../shared/data-store.js';
import { seedPool, pickupZones, destinations, type PoolState } from './model.js';
import {
  GroupError,
  applyForGroup,
  addRider,
  autoMatchGroup,
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
  setDemoRoute,
} from './service.js';

export async function groupRoutes(app: FastifyInstance, { store }: { store: Store }) {
  const get = async (sessionId: string) => {
    const pool = (await store.read(sessionId)).pool;
    if (!pool) throw new GroupError('Open your group workspace first.', 404);
    return pool;
  };
  const mutate = async (sessionId: string, event: string, change: (pool: PoolState) => void) => {
    await store.mutate(sessionId, event, (state) => {
      if (!state.pool) throw new GroupError('Open your group workspace first.', 404);
      syncExpiry(state.pool);
      change(state.pool);
      return { value: null, entityId: state.pool.id };
    });
    return poolView(await get(sessionId));
  };
  app.post('/pool/bootstrap', async (req) =>
    store.mutate(req.sessionId, 'group.opened', (state) => {
      state.pool ??= seedPool();
      syncExpiry(state.pool);
      return { value: poolView(state.pool), entityId: state.pool.id };
    }),
  );
  app.get('/pool', async (req) => {
    const pool = await get(req.sessionId),
      oldVersion = pool.version;
    syncExpiry(pool);
    if (oldVersion !== pool.version)
      return store.mutate(req.sessionId, 'group.availability_changed', (state) => {
        if (!state.pool) throw new GroupError('Open your group workspace first.', 404);
        syncExpiry(state.pool);
        return { value: poolView(state.pool), entityId: state.pool.id };
      });
    return poolView(pool);
  });
  app.post('/pool/location', async (req) => {
    const input = z
      .discriminatedUnion('source', [
        z
          .object({
            source: z.literal('demo'),
            zoneId: z.string().refine((id) => pickupZones.some((zone) => zone.id === id)),
          })
          .strict(),
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
      .object({
        destination: z.string().refine((id) => destinations.some((place) => place.id === id)),
      })
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
  app.post('/pool/demo-route', async (req) => {
    const { routeId } = z
      .object({ routeId: z.string().min(1).max(80) })
      .strict()
      .parse(req.body);
    return mutate(req.sessionId, 'group.demo_route_selected', (pool) =>
      setDemoRoute(pool, routeId),
    );
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
    const input = z
      .object({
        version: z.number().int().positive(),
        minSeats: z.number().int().positive().safe().optional(),
        maxSeats: z.number().int().positive().safe().optional(),
        maxFare: z.number().finite().positive().optional(),
      })
      .strict()
      .parse(req.body);
    return mutate(req.sessionId, 'group.applied', (pool) => {
      if (pool.version !== input.version)
        throw new GroupError('Your journey changed. Review it and apply again.');
      if (
        input.minSeats !== undefined &&
        input.maxSeats !== undefined &&
        input.maxFare !== undefined
      ) {
        setGroupCriteria(pool, {
          minSeats: input.minSeats,
          maxSeats: input.maxSeats,
          maxFare: input.maxFare,
        });
      } else if (
        input.minSeats !== undefined ||
        input.maxSeats !== undefined ||
        input.maxFare !== undefined
      ) {
        throw new GroupError('Provide all group and fare limits together.', 400);
      }
      applyForGroup(pool, pool.version);
    });
  });
  app.post('/pool/criteria', async (req) => {
    const input = z
      .object({
        version: z.number().int().positive(),
        minSeats: z.number().int().positive().safe(),
        maxSeats: z.number().int().positive().safe(),
        maxFare: z.number().finite().positive(),
      })
      .strict()
      .parse(req.body);
    return mutate(req.sessionId, 'group.criteria_updated', (pool) => {
      if (pool.version !== input.version)
        throw new GroupError('Your journey changed. Review your preferences and try again.');
      setGroupCriteria(pool, input);
    });
  });
  app.post('/pool/accept', async () => {
    throw new GroupError('Use the assigned driver account to accept this request.', 403);
  });
  app.post('/pool/action', async (req) => {
    const { action } = z
      .object({ action: z.enum(['cancel', 'start', 'complete', 'new']) })
      .strict()
      .parse(req.body);
    if (action === 'start' || action === 'complete')
      throw new GroupError('Use the assigned driver account for this action.', 403);
    return mutate(req.sessionId, `group.${action}`, (pool) => {
      if (action === 'new') {
        newGroup(pool);
        return;
      }
      if (action === 'cancel' && ['draft', 'requested', 'accepted'].includes(pool.status))
        pool.status = 'cancelled';
      else throw new GroupError('This action is not available for this group.');
      pool.version++;
    });
  });
}
