import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { randomUUID } from 'node:crypto';
import type { Store } from '../../shared/store.js';
import { generateTelebirrSignature, verifyTelebirrSignature, type TelebirrWebhookPayload } from './model.js';
import { broadcastEvent } from '../stream/service.js';

const initiateSchema = z.object({
  bookingId: z.string().optional(),
  groupId: z.string().optional(),
  phoneNumber: z.string().regex(/^(\+251|0)[97]\d{8}$/, 'Enter a valid Ethiopian mobile phone number (09... or 07...)'),
  amount: z.number().positive(),
}).refine((data) => data.bookingId || data.groupId, {
  message: 'Specify either a bookingId or a groupId for payment',
});

const webhookSchema = z.object({
  outTradeNo: z.string().min(1),
  mchShortCode: z.string().min(1),
  totalAmount: z.number().positive(),
  status: z.enum(['SUCCESS', 'FAILED']),
  sign: z.string().min(1),
});

export const paymentRoutes: FastifyPluginAsync<{ store: Store }> = async (api, { store }) => {
  // Initiate Telebirr Merchant USSD Payment
  api.post('/payments/telebirr/initiate', async (req, reply) => {
    const input = initiateSchema.parse(req.body);
    const sessionId = req.sessionId;
    const outTradeNo = `ZEW-TB-${Date.now()}-${randomUUID().slice(0, 6).toUpperCase()}`;

    const transaction = store.mutate(sessionId, 'payment.telebirr_initiated', (state) => {
      let targetFare = input.amount;

      if (input.bookingId) {
        const booking = state.bookings.find((b) => b.id === input.bookingId);
        if (!booking) throw new Error('Booking not found');
        booking.payment = 'pending_telebirr';
        targetFare = booking.fare;
      }

      if (input.groupId && state.pool && state.pool.id === input.groupId) {
        state.pool.history = state.pool.history.map((h) => ({
          ...h,
          paymentStatus: h.id === input.groupId ? 'pending_telebirr' : (h as any).paymentStatus,
        }));
      }

      const tx = {
        id: randomUUID(),
        outTradeNo,
        sessionId,
        bookingId: input.bookingId,
        groupId: input.groupId,
        phoneNumber: input.phoneNumber,
        amount: targetFare,
        status: 'pending_telebirr' as const,
        createdAt: new Date().toISOString(),
      };

      return { value: tx, entityId: outTradeNo };
    });

    const signature = generateTelebirrSignature({
      outTradeNo: transaction.outTradeNo,
      mchShortCode: '10294',
      totalAmount: transaction.amount,
      phoneNumber: transaction.phoneNumber,
    });

    broadcastEvent(sessionId, {
      type: 'payment_update',
      data: { outTradeNo, status: 'pending_telebirr', amount: transaction.amount },
    });

    return reply.code(201).send({
      outTradeNo: transaction.outTradeNo,
      status: 'pending_telebirr',
      amount: transaction.amount,
      phoneNumber: transaction.phoneNumber,
      ussdPushNotice: `Telebirr USSD payment push sent to ${transaction.phoneNumber}. Enter your PIN to confirm.`,
      signature,
    });
  });

  // Telebirr Webhook Callback Endpoint
  api.post('/payments/telebirr/webhook', async (req, reply) => {
    const payload = webhookSchema.parse(req.body) as TelebirrWebhookPayload;

    if (!verifyTelebirrSignature(payload)) {
      return reply.code(401).send({ message: 'Invalid Telebirr signature signature match failed' });
    }

    // Process payment settlement
    broadcastEvent('global', {
      type: 'payment_completed',
      data: {
        outTradeNo: payload.outTradeNo,
        status: payload.status === 'SUCCESS' ? 'paid_telebirr' : 'failed',
        amount: payload.totalAmount,
      },
    });

    return reply.send({ result: 'SUCCESS', code: 200, message: 'Telebirr payment processed' });
  });

  // Verify / Check Payment Status
  api.get('/payments/:outTradeNo/status', async (req, reply) => {
    const { outTradeNo } = req.params as { outTradeNo: string };
    const state = store.read(req.sessionId);
    const booking = state.bookings.find((b) => (b as any).outTradeNo === outTradeNo || b.payment === 'paid_telebirr');

    return reply.send({
      outTradeNo,
      status: booking ? booking.payment : 'pending_telebirr',
      verifiedAt: new Date().toISOString(),
    });
  });
};
