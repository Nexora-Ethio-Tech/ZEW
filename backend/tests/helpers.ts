import { randomUUID } from 'node:crypto';
import { buildApp } from '../src/app.js';
import type { FastifyInstance } from 'fastify';
// Exercise the public quote -> confirmation contract in all reservation regressions.
export async function reserveTrip(
  app: FastifyInstance,
  headers: Record<string, string>,
  journey: object,
) {
  const quote = await app.inject({
    method: 'POST',
    url: '/api/v1/booking-quotes',
    headers,
    payload: journey,
  });
  if (quote.statusCode !== 201) return quote;
  return app.inject({
    method: 'POST',
    url: '/api/v1/bookings',
    headers,
    payload: { quoteId: quote.json().quoteId },
  });
}

// Test-only verified identities. Production still calls the actual Supabase verifier.
export function buildAccountApp(options: Parameters<typeof buildApp>[0] = {}) {
  return buildApp({
    verifyIdentity: async (id) => ({
      id,
      email: id + '@example.test',
      name: 'Test passenger',
      emailConfirmed: true,
    }),
    ...options,
  });
}
export function passengerSession(app: FastifyInstance, id = randomUUID()) {
  return app.inject({
    method: 'POST',
    url: '/api/v1/auth/session',
    headers: { authorization: 'Bearer ' + id },
  });
}
