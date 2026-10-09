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
