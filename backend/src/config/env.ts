import { z } from 'zod';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(4000),
  HOST: z.string().default('127.0.0.1'),
  DATABASE_PATH: z.string().default('./data/zew.sqlite'),
  FRONTEND_ORIGIN: z.string().url().default('http://localhost:3000'),
});

export const env = envSchema.parse(process.env);
