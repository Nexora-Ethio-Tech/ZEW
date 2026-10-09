import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import type { DataStore as Store } from '../../shared/data-store.js';

export async function dispatchRoutes(app: FastifyInstance, { store }: { store: Store }) {
  app.get('/driver/dashboard', async (req) => {
    const driver = await store.driver(req.sessionId);
    // Synchronize expiry in the same persisted passenger workspace before displaying a queue.
    for (const request of await store.listAssigned(req.sessionId)) {
      if (
        request.kind === 'circle' &&
        ['requested', 'accepted'].includes(request.status) &&
        (request.requestedUntil ?? 0) <= Date.now()
      )
        await store.mutateAssigned(req.sessionId, request.id, 'expire', () => null);
    }
    const requests = await store.listAssigned(req.sessionId);
    return {
      driver,
      requests,
      earnings: await store.earnings(req.sessionId),
    };
  });
  app.post('/driver/departures/:id/start', async (req) => {
    const { id } = z.object({ id: z.string().regex(/^[a-f0-9-]{32,36}$/) }).parse(req.params);
    z.object({})
      .strict()
      .parse(req.body ?? {});
    return store.startDeparture(req.sessionId, id);
  });
  app.post('/driver/requests/:id/action', async (req) => {
    await store.driver(req.sessionId);
    const { id } = z.object({ id: z.string().uuid() }).parse(req.params);
    const input = z
      .object({
        action: z.enum(['accept', 'decline', 'start', 'complete']),
        code: z
          .string()
          .regex(/^\d{4}$/)
          .optional(),
      })
      .strict()
      .parse(req.body);
    return store.performDriverAction(req.sessionId, id, input.action, input.code);
  });
}
