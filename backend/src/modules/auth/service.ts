import { createClient } from '@supabase/supabase-js';
import { env } from '../../config/env.js';

export interface VerifiedIdentity {
  id: string;
  email: string;
  name: string;
  emailConfirmed: boolean;
}
export type IdentityVerifier = (accessToken: string) => Promise<VerifiedIdentity | null>;

const provider =
  env.SUPABASE_URL && env.SUPABASE_KEY
    ? createClient(env.SUPABASE_URL, env.SUPABASE_KEY, {
        auth: { persistSession: false, autoRefreshToken: false },
      })
    : null;

export const verifyIdentity: IdentityVerifier = async (accessToken) => {
  if (!provider) return null;
  const { data, error } = await provider.auth.getUser(accessToken);
  if (error || !data.user?.email) return null;
  return {
    id: data.user.id,
    email: data.user.email,
    name:
      typeof data.user.user_metadata?.name === 'string'
        ? data.user.user_metadata.name.slice(0, 100)
        : 'Zew rider',
    emailConfirmed: Boolean(data.user.email_confirmed_at),
  };
};
