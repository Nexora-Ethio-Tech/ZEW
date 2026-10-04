import { createClient } from '@supabase/supabase-js';

const supabaseUrl =
  process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://zeicjamnjnjrrlsptdkx.supabase.co';
const supabaseKey =
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
  'sb_publishable_j8i2whERBRe7Nf8RCCmpfA_Dgys3eEE';

export const supabase = createClient(supabaseUrl, supabaseKey);
