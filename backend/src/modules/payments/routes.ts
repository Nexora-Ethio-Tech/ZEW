import type { FastifyPluginAsync } from 'fastify';
import type { Store } from '../../shared/store.js';

export const paymentRoutes: FastifyPluginAsync<{ store: Store }> = async (api) => {
  // A demo must never claim to send USSD pushes, verify PINs, or settle real money.
  // Leave these routes closed until a provider sandbox and durable ledger are integrated.
  const unavailable = async (_: unknown, reply: import('fastify').FastifyReply) =>
    reply
      .code(501)
      .send({
        message:
          'Payments are not connected. Completing a ride records a private preview receipt only.',
        mode: 'demo',
      });
  api.post('/payments/telebirr/initiate', unavailable);
  api.post('/payments/telebirr/webhook', unavailable);
  api.get('/payments/:outTradeNo/status', unavailable);
};
