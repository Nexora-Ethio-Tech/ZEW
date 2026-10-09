import { z } from 'zod';
import { corridors, validRoute } from '../trips/model.js';
const fields = {
  corridorId: z
    .string()
    .refine((id) => corridors.some((corridor) => corridor.id === id), 'Choose a known corridor'),
  origin: z.string().max(40),
  destination: z.string().max(40),
  departure: z
    .string()
    .datetime({ offset: true })
    .refine((s) => Date.parse(s) > Date.now() - 5 * 60 * 1000, 'Choose a future departure time')
    .refine(
      (s) => Date.parse(s) < Date.now() + 31 * 86400000,
      'Choose a date within the next 30 days',
    ),
  seats: z.number().int().min(1).max(50),
  minSeats: z.number().int().min(1).max(50).optional(),
  maxSeats: z.number().int().min(1).max(50).optional(),
};
export const journeyInput = z
  .object(fields)
  .strict()
  .refine(validRoute, 'Choose two different stops on the selected corridor');
export const quoteInput = z
  .object({ ...fields, tripId: z.string().min(1).max(80) })
  .strict()
  .refine(validRoute, 'Invalid route');
export const commuteInput = z
  .object({ ...fields, name: z.string().trim().min(1).max(40) })
  .strict()
  .refine(validRoute, 'Invalid route');

export const bookingInput = z.object({ quoteId: z.string().uuid() }).strict();
