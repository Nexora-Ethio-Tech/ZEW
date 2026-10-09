import {
  clearAuthSession,
  expireSession,
  getStoredUser,
  setAuthSession,
  storedToken,
  sessionRevision,
  assertCurrentSession,
} from './session';
import { authConfigured, getSupabase } from './supabase';
import type { Session } from '@supabase/supabase-js';

export type Account = NonNullable<ReturnType<typeof getStoredUser>>;
export async function establishSession(session: Session): Promise<Account> {
  const started = sessionRevision();
  // The API independently validates this token and email confirmation with Supabase.
  const response = await fetch('/api/v1/auth/session', {
    method: 'POST',
    headers: { Authorization: `Bearer ${session.access_token}` },
    signal: AbortSignal.timeout(15000),
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.message || 'Your sign-in could not be verified.');
  if (started !== sessionRevision()) throw new Error('Your account changed. Please try again.');
  setAuthSession(data.token, data.user);
  return data.user;
}
let pendingRestore: Promise<Account | null> | undefined;
export function restoreAccount(): Promise<Account | null> {
  if (!pendingRestore) {
    const request = restoreAccountState().finally(() => {
      if (pendingRestore === request) pendingRestore = undefined;
    });
    pendingRestore = request;
  }
  return pendingRestore;
}
async function restoreAccountState(): Promise<Account | null> {
  let expected = sessionRevision();
  const unchanged = () => {
    if (expected !== sessionRevision()) throw new Error('Your account changed. Please try again.');
  };
  if (authConfigured && window.location.hash.includes('access_token=')) {
    const { data, error } = await getSupabase().auth.getSession();
    if (error) throw error;
    unchanged();
    if (data.session) return establishSession(data.session);
  }
  const token = storedToken();
  if (token && getStoredUser()) {
    const response = await fetch('/api/v1/auth/me', {
      headers: { Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(15000),
    });
    assertCurrentSession(token);
    if (response.ok) {
      const user = (await response.json()).user;
      assertCurrentSession(token);
      setAuthSession(token, user);
      return user;
    }
    if (response.status !== 401)
      throw new Error('Could not verify your account. Please try again.');
    expireSession(token);
    expected = sessionRevision();
  }
  if (authConfigured) {
    const { data, error } = await getSupabase().auth.getSession();
    if (error) throw error;
    unchanged();
    if (data.session) return establishSession(data.session);
  }
  unchanged();
  if (getStoredUser()) clearAuthSession();
  return null;
}
export async function signOut() {
  const started = sessionRevision();
  const token = storedToken();
  if (token) {
    const response = await fetch('/api/v1/auth/logout', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(15000),
    });
    if (!response.ok && response.status !== 401)
      throw new Error('Could not sign out. Please try again.');
    assertCurrentSession(token);
  }
  if (authConfigured) {
    const { error } = await getSupabase().auth.signOut({ scope: 'local' });
    if (error) throw new Error('Could not finish signing out. Please try again.');
  }
  if (started !== sessionRevision() || storedToken() !== token)
    throw new Error('Your account changed. Please try again.');
  clearAuthSession();
}
