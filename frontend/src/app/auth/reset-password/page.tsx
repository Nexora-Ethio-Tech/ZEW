'use client';

import { useEffect, useState, type FormEvent } from 'react';
import Link from 'next/link';
import { getSupabase } from '@/lib/supabase';
import { clearAuthSession } from '@/lib/session';
import '@/features/auth/auth.css';

export default function ResetPasswordPage() {
  const [ready, setReady] = useState(false);
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  useEffect(() => {
    let active = true;
    async function verifyLink() {
      try {
        const supabase = getSupabase();
        const hash = new URLSearchParams(window.location.hash.slice(1));
        const accessToken = hash.get('access_token');
        const refreshToken = hash.get('refresh_token');
        if (accessToken && refreshToken) {
          const { error } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken,
          });
          if (error) throw error;
          window.history.replaceState(null, '', window.location.pathname + window.location.search);
        }
        const { data, error } = await supabase.auth.getSession();
        if (!active) return;
        if (error || !data.session)
          setError(
            'This password reset link is invalid or expired. Request a new one from Sign in.',
          );
        else setReady(true);
      } catch {
        if (active) setError('Could not verify this reset link. Try opening it again.');
      }
    }
    void verifyLink();
    return () => {
      active = false;
    };
  }, []);
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (password !== confirmation) {
      setError('Passwords do not match.');
      return;
    }
    if (password.length < 12) {
      setError('Use at least 12 characters for your new password.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      const { error } = await getSupabase().auth.updateUser({ password });
      if (error) throw error;
      setPassword('');
      setConfirmation('');
      setDone(true);
      await getSupabase().auth.signOut({ scope: 'local' });
      clearAuthSession();
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Could not update your password.');
    } finally {
      setBusy(false);
    }
  }
  return (
    <main className="auth-reset-page">
      <section className="auth-reset-card">
        <h1>{done ? 'Password updated.' : 'Choose a new password.'}</h1>
        {error && (
          <p role="alert" className="auth-error-notice">
            {error}
          </p>
        )}
        {done ? (
          <>
            <p>Sign in with your email and new password.</p>
            <Link href="/login">Sign in</Link>
          </>
        ) : ready ? (
          <form className="auth-form" onSubmit={submit}>
            <label className="auth-field">
              New password
              <input
                type="password"
                autoComplete="new-password"
                required
                minLength={12}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </label>
            <label className="auth-field">
              Confirm password
              <input
                type="password"
                autoComplete="new-password"
                required
                minLength={12}
                value={confirmation}
                onChange={(e) => setConfirmation(e.target.value)}
              />
            </label>
            <button type="submit" className="auth-submit-btn" disabled={busy}>
              {busy ? 'Saving…' : 'Save password'}
            </button>
          </form>
        ) : (
          !error && <p role="status">Checking your reset link…</p>
        )}
        {!done && <Link href="/login">Back to sign in</Link>}
      </section>
    </main>
  );
}
