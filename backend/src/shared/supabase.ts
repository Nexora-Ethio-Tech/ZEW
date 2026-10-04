import { createClient } from '@supabase/supabase-js';
import { env } from '../config/env.js';

const isTestEnvironment =
  process.env.NODE_ENV === 'test' ||
  process.argv.some((arg) => arg.includes('test'));

export const supabase =
  !isTestEnvironment && env.SUPABASE_URL && env.SUPABASE_KEY
    ? createClient(env.SUPABASE_URL, env.SUPABASE_KEY)
    : null;
