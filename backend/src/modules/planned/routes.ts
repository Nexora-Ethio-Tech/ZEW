import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import type { DataStore as Store } from '../../shared/data-store.js';
import { ApiError } from '../../shared/http-error.js';
import {
  dashboard,
  matches,
  reserveWithinBudget,
  quote,
  reserve,
  cancel,
  saveCommute,
  removeCommute,
} from './service.js';
import { journeyInput, quoteInput, bookingInput, commuteInput } from './schemas.js';

export async function plannedRoutes(app: FastifyInstance, { store }: { store: Store }) {
  app.get('/dashboard', async (req) => dashboard(store, req.sessionId));
  app.post('/matches', async (req) => matches(store, req.sessionId, journeyInput.parse(req.body)));
  app.post('/group-requests', async (req, reply) => {
    const raw = z
      .object({
        corridorId: z.string(),
        origin: z.string(),
        destination: z.string(),
        departure: z.string(),
        seats: z.number().int().min(1).max(50),
        maxFare: z.number().finite().positive().max(100000),
      })
      .strict()
      .parse(req.body);
    const { maxFare, ...journey } = raw;
    journeyInput.parse(journey);
    return reply.code(201).send(await reserveWithinBudget(store, req.sessionId, { ...journey, maxFare }));
  });
  app.post('/booking-quotes', async (req, reply) =>
    reply.code(201).send(await quote(store, req.sessionId, quoteInput.parse(req.body))),
  );
  app.post('/bookings', async (req, reply) =>
    reply.code(201).send(await reserve(store, req.sessionId, bookingInput.parse(req.body).quoteId)),
  );
  app.post('/bookings/:id/action', async (req) => {
    const input = z
      .object({
        action: z.enum(['board', 'complete', 'cancel']),
        code: z.string().max(4).optional(),
      })
      .strict()
      .parse(req.body);
    if (input.action !== 'cancel')
      throw new ApiError(403, 'Driver access is required for this action');
    const { id } = z.object({ id: z.string().uuid() }).parse(req.params);
    return cancel(store, req.sessionId, id);
  });
  app.post('/commutes', async (req, reply) =>
    reply.code(201).send(await saveCommute(store, req.sessionId, commuteInput.parse(req.body))),
  );
  app.delete('/commutes/:id', async (req) => {
    const { id } = z.object({ id: z.string().uuid() }).parse(req.params);
    return removeCommute(store, req.sessionId, id);
  });
  // Preserve explicit denials for old clients; driver actions live only under /driver.
  app.post('/trips', async () => {
    throw new ApiError(403, 'Use the driver workspace for driver actions.');
  });
  app.post('/trips/:id/cancel', async () => {
    throw new ApiError(403, 'Use the driver workspace for driver actions.');
  });
  app.post('/waitlist', async (req) => {
    const input = z
      .object({
        name: z.string().trim().min(2).max(80),
        email: z.string().trim().email().max(120),
        role: z.enum(['rider', 'driver']),
        consent: z.literal(true),
      })
      .strict()
      .parse(req.body);
    return store.mutate(req.sessionId, 'waitlist.joined', (state) => {
      state.waitlist = {
        name: input.name,
        email: input.email,
        role: input.role,
        consentAt: new Date().toISOString(),
      };
      return { value: { ok: true }, entityId: req.sessionId };
    });
  });
}
