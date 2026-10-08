import { z } from 'zod';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(4000),
  HOST: z.string().default('0.0.0.0'),
  DATABASE_PATH: z.string().default('./data/zew.sqlite'),
  FRONTEND_ORIGIN: z.string().default('http://localhost:3000'),
  SUPABASE_URL: z.string().default(''),
  SUPABASE_KEY: z.string().default(''),
  OSRM_URL: z.string().optional(),
});

export const env = envSchema.parse(process.env);
