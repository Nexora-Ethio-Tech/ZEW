import Fastify from 'fastify';
import cors from '@fastify/cors';
import { ZodError } from 'zod';
import type { DataStore } from './shared/data-store.js';
import { Store } from './shared/store.js';
import { env } from './config/env.js';
import { groupRoutes } from './modules/groups/routes.js';
import { destinations, pickupZones, MAX_MEMBERS } from './modules/groups/model.js';
import { placeRoutes } from './modules/groups/places.js';
import { paymentRoutes } from './modules/payments/routes.js';
import { routingRoutes } from './modules/routing/routes.js';
import { streamRoutes } from './modules/stream/routes.js';
import type { IdentityVerifier } from './modules/auth/service.js';
import { authRoutes } from './modules/auth/routes.js';
import { dispatchRoutes } from './modules/dispatch/routes.js';
import { plannedRoutes } from './modules/planned/routes.js';
import { withCommand } from './shared/commands.js';
import { RateLimitError } from './shared/rate-limits.js';
import { ApiError } from './shared/http-error.js';

export function buildApp({
  databasePath = ':memory:',
  logger = false,
  verifyIdentity,
  store: providedStore,
}: {
  databasePath?: string;
  logger?: boolean;
  verifyIdentity?: IdentityVerifier;
  store?: DataStore;
} = {}) {
  const app = Fastify({
    logger: logger
      ? { serializers: { req: (req) => ({ method: req.method, id: req.id }) } }
      : false,
    bodyLimit: 16384,
  });
  const store: DataStore = providedStore ?? new Store(databasePath);
  app.addHook('onReady', async () => {
    await store.initialize?.();
  });
  app.register(cors, { origin: env.FRONTEND_ORIGIN });
  app.addHook('onClose', async () => store.close());
  app.addHook('onRequest', async (req, reply) => {
    reply
      .header('X-Request-Id', req.id)
      .header('Cache-Control', 'no-store')
      .header('X-Content-Type-Options', 'nosniff');
    await store.limitRequests(req.ip);
  });
  app.addHook('onResponse', async (req, reply) => {
    // The route template excludes path parameters, queries, credentials and boarding codes.
    try {
      await store.metric(req.routeOptions.url ?? 'unmatched', reply.statusCode, reply.elapsedTime);
    } catch {
      req.log.error({ requestId: req.id }, 'Metric write failed');
    }
  });
  app.setErrorHandler((error, req, reply) => {
    if (error instanceof ZodError)
      return reply.code(400).send({ message: error.issues[0]?.message ?? 'Check your details' });
    const known = error as { statusCode?: number; message?: string };
    const status = known.statusCode ?? 500;
    if (error instanceof RateLimitError) reply.header('Retry-After', error.retryAfter);
    if (status >= 500)
      req.log.error({ requestId: req.id, route: req.routeOptions.url, status }, 'Request failed');
    return reply
      .code(status)
      .send({ message: status >= 500 ? 'Something went wrong. Please try again.' : known.message });
  });
  app.get('/api/v1/health', async () => ({
    status: (await store.ready()) ? 'ok' : 'unavailable',
    service: 'zew-api',
    mode: 'demo',
  }));
  app.get('/api/v1/fare-preview', async () => ({
    pickup: pickupZones.find((place) => place.id === 'edna')?.name ?? pickupZones[0].name,
    destination: destinations.find((place) => place.id === 'meskel')?.name ?? destinations[0].name,
    total: destinations.find((place) => place.id === 'meskel')?.fare ?? destinations[0].fare,
    maxPeople: MAX_MEMBERS,
  }));
  app.post('/api/v1/session', async (_, reply) =>
    reply
      .code(401)
      .send({ message: 'Create an account and confirm your email, or sign in to continue.' }),
  );
  app.register(authRoutes, { store, verifyIdentity });
  app.register(
    async (api) => {
      api.decorateRequest('sessionId', '');
      api.addHook('onRoute', (route) => {
        const handler = route.handler;
        route.handler = function (req, reply) {
          return withCommand(req.headers['idempotency-key'], req.method, req.url, req.body, () =>
            handler.call(this, req, reply),
          );
        };
      });
      api.addHook('preHandler', async (req) => {
        const header = req.headers.authorization;
        const token = header?.startsWith('Bearer ') ? header.slice(7) : '';
        const id = token.length === 64 ? await store.session(token) : undefined;
        if (!id) throw new ApiError(401, 'Sign in to continue.');
        req.sessionId = id;
        const account = (await store.read(id)).user;
        if (!account)
          throw new ApiError(
            401,
            'Create an account and confirm your email, or sign in to continue.',
          );
        await store.limitActor(id);
        if (account.role === 'driver' && !req.url.startsWith('/api/v1/driver/'))
          throw new ApiError(403, 'Use your driver workspace for this account.');
      });
      api.register(groupRoutes, { store });
      api.register(dispatchRoutes, { store });
      api.register(placeRoutes);
      api.register(paymentRoutes, { store });
      api.register(routingRoutes);
      api.register(streamRoutes);
      api.register(plannedRoutes, { store });
    },
    { prefix: '/api/v1' },
  );
  return app;
}
declare module 'fastify' {
  interface FastifyRequest {
    sessionId: string;
  }
}
