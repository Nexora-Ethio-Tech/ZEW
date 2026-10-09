'use client';

import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Icon } from '@/components/icon';
import { authConfigured, getSupabase } from '@/lib/supabase';
import { establishSession, type Account } from '@/lib/auth';
import './auth.css';

export function AuthModal({
  isOpen,
  onClose,
  onSuccess,
  initialTab = 'login',
}: {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (user: Account) => void;
  initialTab?: 'login' | 'signup';
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [tab, setTab] = useState(initialTab);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [verificationSent, setVerificationSent] = useState(false);
  async function sendEmailLink() {
    setError(''); setBusy(true);
    try {
      const { error } = await getSupabase().auth.signInWithOtp({ email: email.trim(), options: {
        emailRedirectTo: window.location.origin + '/auth/callback',
      } });
      if (error) throw error;
      setPassword(''); setVerificationSent(true);
    } catch (e) { setError(e instanceof Error ? e.message : 'Could not send your email link.'); }
    finally { setBusy(false); }
  }
  useEffect(() => {
    if (isOpen) {
      setTab(initialTab);
      dialog.current?.showModal();
    } else dialog.current?.close();
  }, [isOpen, initialTab]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError('');
    setBusy(true);
    try {
      const provider = getSupabase();
      if (tab === 'signup') {
        const { error } = await provider.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: window.location.origin + '/auth/callback',
            data: { name: name.trim() },
          },
        });
        if (error) throw error;
        // No API session or account is created until the provider verifies the user.
        setPassword('');
        setVerificationSent(true);
        return;
      }
      const { data, error } = await provider.auth.signInWithPassword({ email, password });
      if (error) throw error;
      if (!data.session) throw new Error('Confirm your email before signing in.');
      const user = await establishSession(data.session);
      setPassword('');
      onSuccess(user);
      onClose();
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Unable to sign in. Please try again.');
    } finally {
      setBusy(false);
    }
  }
  return (
    <dialog
      ref={dialog}
      className="auth-dialog"
      aria-labelledby="auth-title"
      onCancel={(event) => {
        event.preventDefault();
        if (!busy) onClose();
      }}
      onClick={(event) => {
        if (event.target === event.currentTarget && !busy) onClose();
      }}
    >
      <div className="auth-modal-card">
        <button
          className="auth-close-btn"
          onClick={onClose}
          disabled={busy}
          aria-label="Close dialog"
        >
          <Icon name="close" size={20} />
        </button>
        <span className="auth-logo">
          zew
          <span className="auth-logo-arrow">
            <Icon name="arrow" size={22} />
          </span>
        </span>
        {verificationSent ? (
          <>
            <span className="auth-mail-icon">
              <Icon name="check" size={28} />
            </span>
            <h2 id="auth-title">Check your inbox.</h2>
            <p>
              Look for a sign-in or confirmation link at <strong>{email}</strong>.
              Open it to verify your email and continue to your account.
            </p>
            <button
              className="auth-submit-btn"
              onClick={() => {
                setVerificationSent(false);
                setTab('login');
              }}
            >
              Back to sign in <Icon name="arrow" size={18} />
            </button>
          </>
        ) : (
          <>
            <p className="auth-eyebrow">A LITTLE LESS SOLO.</p>
            <h2 id="auth-title">{tab === 'login' ? 'Good to see you.' : 'Your next chapter.'}</h2>
            <p>
              {tab === 'login'
                ? 'Sign in to open the workspace assigned to your account.'
                : 'Create your account, then confirm your email. Driver access requires an invitation.'}
            </p>
            <div className="auth-tabs" aria-label="Account action">
              {(['login', 'signup'] as const).map((action) => (
                <button
                  key={action}
                  className={tab === action ? 'active' : ''}
                  disabled={busy}
                  aria-pressed={tab === action}
                  onClick={() => {
                    setTab(action);
                    setError('');
                  }}
                >
                  {action === 'login' ? 'Sign in' : 'Create account'}
                </button>
              ))}
            </div>
            {!authConfigured && (
              <p className="auth-config-note" role="status">
                Account sign-in is not available on this installation yet.{' '}
                <a href="/rides">Explore ride circles instead</a>
              </p>
            )}
            {error && (
              <p className="auth-error-notice" role="alert">
                {error}
              </p>
            )}
            <form onSubmit={submit} className="auth-form">
              {tab === 'signup' && (
                <label className="auth-field" htmlFor="auth-name">
                  Your name
                  <input
                    id="auth-name"
                    autoComplete="name"
                    required
                    minLength={2}
                    maxLength={100}
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Your full name"
                  />
                </label>
              )}
              <label className="auth-field" htmlFor="auth-email">
                Email address
                <input
                  id="auth-email"
                  type="email"
                  autoComplete="email"
                  required
                  maxLength={254}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                />
              </label>
              <label className="auth-field" htmlFor="auth-password">
                Password
              </label>
              <div className="auth-password-wrapper">
                <input
                  id="auth-password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete={tab === 'signup' ? 'new-password' : 'current-password'}
                  required
                  minLength={tab === 'signup' ? 12 : 1}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder={tab === 'signup' ? 'At least 12 characters' : 'Your password'}
                />
                <button
                  type="button"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  onClick={() => setShowPassword(!showPassword)}
                >
                  <Icon name={showPassword ? 'eye-off' : 'eye'} size={18} />
                </button>
              </div>
              <button className="auth-submit-btn" disabled={busy || !authConfigured} type="submit">
                {busy
                  ? 'Please wait…'
                  : tab === 'login'
                    ? 'Sign in'
                    : 'Create account & send email'}
                <Icon name="arrow" size={18} />
              </button>
            </form>
            <button type="button" className="auth-submit-btn" disabled={busy || !authConfigured || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())} onClick={() => void sendEmailLink()}>
              Email me a sign-in link
            </button>
            <p className="auth-footnote">Preview environment · no live rides or payments</p>
          </>
        )}
      </div>
    </dialog>
  );
}
