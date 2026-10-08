import { clearAuthSession, getStoredUser, setAuthSession } from './api';
import { authConfigured, getSupabase } from './supabase';
import type { Session } from '@supabase/supabase-js';

export type Account = NonNullable<ReturnType<typeof getStoredUser>>;
export async function establishSession(session: Session): Promise<Account> {
  // The API independently validates this token and email confirmation with Supabase.
  const response = await fetch('/api/v1/auth/session', {
    method: 'POST',
    headers: { Authorization: `Bearer ${session.access_token}` },
    signal: AbortSignal.timeout(15000),
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.message || 'Your sign-in could not be verified.');
  setAuthSession(data.token, data.user);
  return data.user;
}
export async function restoreAccount(): Promise<Account | null> {
  const token = localStorage.getItem('zew-demo-session');
  if (token && getStoredUser()) {
    const response = await fetch('/api/v1/auth/me', {
      headers: { Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(15000),
    });
    if (response.ok) return (await response.json()).user;
    clearAuthSession();
  }
  if (authConfigured) {
    const { data, error } = await getSupabase().auth.getSession();
    if (error) throw error;
    if (data.session) return establishSession(data.session);
  }
  return null;
}
export async function signOut() {
  const token = localStorage.getItem('zew-demo-session');
  if (token) {
    const response = await fetch('/api/v1/auth/logout', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(15000),
    });
    if (!response.ok) throw new Error('Could not sign out. Please try again.');
  }
  clearAuthSession();
  if (authConfigured) await getSupabase().auth.signOut({ scope: 'local' });
}
