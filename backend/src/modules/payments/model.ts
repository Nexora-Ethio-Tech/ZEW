import { createHmac, timingSafeEqual } from 'node:crypto';

export type PaymentMethod = 'telebirr' | 'cbe_birr' | 'cash';
export type PaymentStatus =
  'not_due' | 'pending_telebirr' | 'paid_telebirr' | 'simulated' | 'failed';

export interface TelebirrInitiateInput {
  bookingId?: string;
  groupId?: string;
  phoneNumber: string;
  amount: number;
}

export interface TelebirrTransaction {
  id: string;
  sessionId: string;
  bookingId?: string;
  groupId?: string;
  phoneNumber: string;
  amount: number;
  status: PaymentStatus;
  outTradeNo: string;
  createdAt: string;
  paidAt?: string;
}

export interface TelebirrWebhookPayload {
  outTradeNo: string;
  mchShortCode: string;
  totalAmount: number;
  status: 'SUCCESS' | 'FAILED';
  sign: string;
}

export function generateTelebirrSignature(
  payload: Record<string, string | number>,
  secretKey = 'zew_telebirr_demo_secret',
): string {
  const sortedKeys = Object.keys(payload)
    .filter((key) => key !== 'sign' && payload[key] !== undefined && payload[key] !== '')
    .sort();
  const queryString = sortedKeys.map((key) => `${key}=${payload[key]}`).join('&');
  return createHmac('sha256', secretKey).update(queryString).digest('hex').toUpperCase();
}

export function verifyTelebirrSignature(
  payload: TelebirrWebhookPayload,
  secretKey = 'zew_telebirr_demo_secret',
): boolean {
  const { sign, ...rest } = payload;
  const expectedSign = generateTelebirrSignature(
    rest as unknown as Record<string, string | number>,
    secretKey,
  );
  if (!/^[a-fA-F0-9]{64}$/.test(sign)) return false;
  return timingSafeEqual(Buffer.from(sign, 'hex'), Buffer.from(expectedSign, 'hex'));
}
