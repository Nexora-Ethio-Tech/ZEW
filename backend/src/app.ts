import Fastify from 'fastify';
import cors from '@fastify/cors';
import { randomInt, randomUUID } from 'node:crypto';
import { z, ZodError } from 'zod';
import { Store } from './shared/store.js';
import { corridors, sampleTripsForTime, validRoute, type Booking, type Trip } from './modules/trips/model.js';
import { availableSeats, findMatches, rejectionReason } from './modules/matching/service.js';
import { env } from './config/env.js';
import { groupRoutes } from './modules/groups/routes.js';
import { placeRoutes } from './modules/groups/places.js';
import { paymentRoutes } from './modules/payments/routes.js';
import { routingRoutes } from './modules/routing/routes.js';
import { streamRoutes } from './modules/stream/routes.js';
import { authRoutes } from './modules/auth/routes.js';

class ApiError extends Error {
  constructor(
    public statusCode: number,
    message: string,
  ) {
    super(message);
  }
}
const fields = {
  corridorId: z.enum(['bole-centre', 'cmc-centre', 'bole-cmc']),
  origin: z.string().max(40),
  destination: z.string().max(40),
  departure: z
    .string()
    .datetime({ offset: true })
    .refine(
      (s) => Date.parse(s) > Date.now() - 5 * 60 * 1000,
      'Choose a future departure time',
    )
    .refine(
      (s) => Date.parse(s) < Date.now() + 31 * 86400000,
      'Choose a date within the next 30 days',
    ),
  seats: z.number().int().min(1).max(50),
  minSeats: z.number().int().min(1).max(50).optional(),
  maxSeats: z.number().int().min(1).max(50).optional(),
};
const journey = z
  .object(fields)
  .strict()
  .refine(validRoute, 'Choose two different stops on the selected corridor');
const bookingInput = z
  .object({ ...fields, tripId: z.string().min(1).max(80) })
  .strict()
  .refine(validRoute, 'Invalid route');
const commuteInput = z
  .object({ ...fields, name: z.string().trim().min(1).max(40) })
  .strict()
  .refine(validRoute, 'Invalid route');
const tripInput = z
  .object({
    ...fields,
    driver: z.string().trim().min(2).max(40),
    vehicle: z.string().trim().min(2).max(60),
  })
  .strict()
  .refine(validRoute, 'Invalid route');

export function buildApp({ databasePath = ':memory:', logger = false } = {}) {
  const app = Fastify({
    logger: logger ? { redact: ['req.headers.authorization'] } : false,
    bodyLimit: 16384,
  });
  const store = new Store(databasePath);
  const limits = new Map<string, { count: number; expires: number }>();
  app.register(cors, { origin: true });
  app.addHook('onClose', async () => store.close());
  app.addHook('onRequest', async (req, reply) => {
    reply.header('Cache-Control', 'no-store').header('X-Content-Type-Options', 'nosniff');
    const now = Date.now();
    if (limits.size > 1000)
      for (const [key, value] of limits) if (value.expires < now) limits.delete(key);
    const key = req.ip,
      limit = limits.get(key);
    if (!limit || limit.expires < now) limits.set(key, { count: 1, expires: now + 60000 });
    else if (++limit.count > 120)
      throw new ApiError(429, 'Too many requests. Please try again in a minute.');
  });
  app.setErrorHandler((error, req, reply) => {
    if (error instanceof ZodError)
      return reply.code(400).send({ message: error.issues[0]?.message ?? 'Check your details' });
    const known = error as { statusCode?: number; message?: string };
    const status = known.statusCode ?? 500;
    if (status >= 500) req.log.error(error);
    return reply
      .code(status)
      .send({ message: status >= 500 ? 'Something went wrong. Please try again.' : known.message });
  });
  app.get('/api/v1/health', async () => ({ status: 'ok', service: 'zew-api', mode: 'demo' }));
  app.post('/api/v1/session', async (_, reply) => reply.code(201).send(store.create()));
  app.register(authRoutes, { store });
  app.register(
    async (api) => {
      api.decorateRequest('sessionId', '');
      api.addHook('preHandler', async (req) => {
        const header = req.headers.authorization;
        const token = header?.startsWith('Bearer ') ? header.slice(7) : '';
        const id = token.length === 64 ? store.session(token) : undefined;
        if (!id) throw new ApiError(401, 'Your demo session has expired. Refresh to start again.');
        req.sessionId = id;
      });
      api.register(groupRoutes, { store });
      api.register(placeRoutes);
      api.register(paymentRoutes, { store });
      api.register(routingRoutes);
      api.register(streamRoutes);
      api.get('/dashboard', async (req) => {
        const state = store.read(req.sessionId);
        const completed = state.bookings.filter((booking) => booking.status === 'completed');
        const totalFare = completed.reduce((sum, booking) => sum + booking.fare, 0);
        const platformFee = Math.round(totalFare * 10) / 100;
        return {
          mode: 'demo',
          corridors,
          trips: state.trips.map((t) => ({ ...t, availableSeats: availableSeats(state, t) })),
          bookings: state.bookings,
          commutes: state.commutes,
          waitlistJoined: !!state.waitlist,
          events: store.events(req.sessionId),
          demoEarnings: {
            completedTrips: completed.length,
            totalFare,
            platformFee,
            driverPayout: totalFare - platformFee,
          },
        };
      });
      api.post('/matches', async (req) =>
        findMatches(store.read(req.sessionId), journey.parse(req.body)),
      );
      api.post('/bookings', async (req, reply) => {
        const input = bookingInput.parse(req.body);
        return reply.code(201).send(
          store.mutate(req.sessionId, 'booking.confirmed', (state) => {
            let trip = state.trips.find((t) => t.id === input.tripId);
            if (!trip) {
              const dynamicSamples = sampleTripsForTime(input.departure);
              trip = dynamicSamples.find((t) => t.id === input.tripId);
              if (trip) {
                state.trips.push(trip);
              }
            }
            if (!trip && input.tripId.startsWith('ondemand-')) {
              const driverName = input.tripId.endsWith('-1')
                ? 'Solomon H.'
                : input.tripId.endsWith('-2')
                  ? 'Hiwot A.'
                  : 'Yonas M.';
              const vehicleName = input.tripId.endsWith('-1')
                ? 'Toyota Corolla · Silver'
                : input.tripId.endsWith('-2')
                  ? 'Suzuki Swift · Blue'
                  : 'Hyundai Atos · White';
              trip = {
                id: input.tripId,
                corridorId: input.corridorId,
                origin: input.origin,
                destination: input.destination,
                departure: input.departure,
                seats: 4,
                driver: driverName,
                vehicle: vehicleName,
                fare: 80,
                source: 'sample',
                status: 'open',
              };
              state.trips.push(trip);
            }
            if (!trip) throw new ApiError(404, 'Trip not found');
            const reason = rejectionReason(state, trip, input);
            if (reason) throw new ApiError(409, reason);
            const booking: Booking = {
              ...input,
              id: randomUUID(),
              departure: trip.departure,
              driver: trip.driver,
              vehicle: trip.vehicle,
              fare: trip.fare * input.seats,
              status: 'confirmed',
              code: String(randomInt(1000, 10000)),
              createdAt: new Date().toISOString(),
              payment: 'not_due',
            };
            state.bookings.unshift(booking);
            return { value: booking, entityId: booking.id };
          }),
        );
      });
      api.post('/bookings/:id/action', async (req) => {
        const { id } = req.params as { id: string };
        const input = z
          .object({
            action: z.enum(['board', 'complete', 'cancel']),
            code: z.string().max(4).optional(),
          })
          .strict()
          .parse(req.body);
        return store.mutate(req.sessionId, `booking.${input.action}`, (state) => {
          const booking = state.bookings.find((b) => b.id === id);
          if (!booking) throw new ApiError(404, 'Booking not found');
          if (input.action === 'cancel' && booking.status === 'confirmed')
            booking.status = 'cancelled';
          else if (input.action === 'board' && booking.status === 'confirmed') {
            if (input.code !== booking.code)
              throw new ApiError(400, 'That boarding code does not match');
            booking.status = 'in_progress';
          } else if (input.action === 'complete' && booking.status === 'in_progress') {
            booking.status = 'completed';
            booking.payment = 'simulated';
          } else
            throw new ApiError(409, 'This action is not available for the current trip status');
          return { value: booking, entityId: id };
        });
      });
      api.post('/commutes', async (req, reply) => {
        const input = commuteInput.parse(req.body);
        return reply.code(201).send(
          store.mutate(req.sessionId, 'commute.saved', (state) => {
            if (state.commutes.length >= 10)
              throw new ApiError(409, 'You can save up to 10 commutes');
            const commute = { ...input, id: randomUUID() };
            state.commutes.push(commute);
            return { value: commute, entityId: commute.id };
          }),
        );
      });
      api.delete('/commutes/:id', async (req) =>
        store.mutate(req.sessionId, 'commute.removed', (state) => {
          const { id } = req.params as { id: string };
          if (!state.commutes.some((c) => c.id === id))
            throw new ApiError(404, 'Commute not found');
          state.commutes = state.commutes.filter((c) => c.id !== id);
          return { value: { ok: true }, entityId: id };
        }),
      );
      api.post('/trips', async (req, reply) => {
        const input = tripInput.parse(req.body);
        return reply.code(201).send(
          store.mutate(req.sessionId, 'trip.offered', (state) => {
            if (state.trips.length >= 50) throw new ApiError(409, 'Demo trip limit reached');
            const trip: Trip = {
              ...input,
              id: randomUUID(),
              fare: 100,
              status: 'open',
              source: 'yours',
            };
            state.trips.unshift(trip);
            return { value: trip, entityId: trip.id };
          }),
        );
      });
      api.post('/trips/:id/cancel', async (req) =>
        store.mutate(req.sessionId, 'trip.cancelled', (state) => {
          const { id } = req.params as { id: string };
          const trip = state.trips.find((t) => t.id === id && t.source === 'yours');
          if (!trip) throw new ApiError(404, 'Trip not found');
          if (trip.status !== 'open') throw new ApiError(409, 'Trip is already cancelled');
          trip.status = 'cancelled';
          return { value: trip, entityId: trip.id };
        }),
      );
      api.post('/waitlist', async (req) => {
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
