'use client';

import { useState } from 'react';
import { Icon } from '@/components/icon';
import { setAuthSession } from '@/lib/api';
import { supabase } from '@/lib/supabase';

export function AuthModal({
  isOpen,
  onClose,
  onSuccess,
}: {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (user: { id: string; email: string; name: string; role: string }) => void;
}) {
  const [tab, setTab] = useState<'login' | 'signup'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [name, setName] = useState('');
  const [role, setRole] = useState<'rider' | 'driver' | 'operator'>('rider');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [verificationSent, setVerificationSent] = useState(false);

  if (!isOpen) return null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);

    try {
      if (tab === 'signup') {
        // Trigger Supabase email verification dispatch
        try {
          await supabase.auth.signUp({
            email,
            password,
            options: {
              data: { name, role },
            },
          });
        } catch (supabaseErr: any) {
          console.warn('[Supabase Auth Email Dispatch Notice]:', supabaseErr?.message);
        }
      }

      const endpoint = tab === 'login' ? '/api/v1/auth/login' : '/api/v1/auth/signup';
      const body =
        tab === 'login'
          ? { email, password }
          : { email, name, password, role };

      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || 'Authentication failed. Please check details.');
      }

      setAuthSession(data.token, data.user);

      if (tab === 'signup') {
        setVerificationSent(true);
      } else {
        onSuccess(data.user);
        onClose();
      }
    } catch (err: any) {
      setError(err.message || 'An error occurred.');
    } finally {
      setBusy(false);
    }
  }

  if (verificationSent) {
    return (
      <div className="auth-modal-backdrop" onClick={onClose}>
        <div
          className="auth-modal-card"
          onClick={(e) => e.stopPropagation()}
          style={{ textContent: 'center', textAlign: 'center', padding: '36px 28px' }}
        >
          <div style={{ fontSize: 52, marginBottom: 16 }}>📩</div>
          <h2 style={{ fontSize: 24, fontWeight: 800, color: '#0f172a', marginBottom: 12 }}>
            Check Your Email
          </h2>
          <p style={{ fontSize: 14, color: '#475569', marginBottom: 24, lineHeight: 1.6 }}>
            We’ve sent a confirmation email to <strong style={{ color: '#059669' }}>{email}</strong> using your Zew custom email template. Please click the verification link inside to confirm your account.
          </p>
          <button
            className="auth-submit-btn"
            style={{ width: '100%', justifyContent: 'center' }}
            onClick={() => {
              setVerificationSent(false);
              onSuccess({ id: 'user-new', email, name, role });
              onClose();
            }}
          >
            I Checked My Email / Continue
            <Icon name="arrow" size={16} />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="auth-modal-backdrop" onClick={onClose}>
      <div className="auth-modal-card" onClick={(e) => e.stopPropagation()}>
        <button className="auth-close-btn" onClick={onClose} aria-label="Close modal">
          <Icon name="close" size={16} />
        </button>

        <div className="auth-header">
          <span className="auth-logo">zew<span>↗</span></span>
          <h2>{tab === 'login' ? 'Welcome back to Zew' : 'Create your Zew account'}</h2>
          <p>
            {tab === 'login'
              ? 'Sign in to access your ride circle workspace and planned commutes'
              : 'Join the shared ride community across Addis Ababa'}
          </p>
        </div>

        <div className="auth-tabs">
          <button
            type="button"
            className={`auth-tab ${tab === 'login' ? 'active' : ''}`}
            onClick={() => setTab('login')}
          >
            Sign In
          </button>
          <button
            type="button"
            className={`auth-tab ${tab === 'signup' ? 'active' : ''}`}
            onClick={() => setTab('signup')}
          >
            Sign Up
          </button>
        </div>

        {error && <div className="auth-error-notice">{error}</div>}

        <form onSubmit={handleSubmit} className="auth-form">
          {tab === 'signup' && (
            <div className="auth-field">
              <label>Full Name</label>
              <input
                type="text"
                required
                placeholder="e.g. Abebe Bikila"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>
          )}

          <div className="auth-field">
            <label>Email Address</label>
            <input
              type="email"
              required
              placeholder="e.g. rider@zew.et"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>

          <div className="auth-field">
            <label>Password</label>
            <div className="auth-password-wrapper">
              <input
                type={showPassword ? 'text' : 'password'}
                required
                placeholder="Enter password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
              <button
                type="button"
                className="auth-password-toggle"
                onClick={() => setShowPassword(!showPassword)}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                <Icon name={showPassword ? 'eye-off' : 'eye'} size={18} />
              </button>
            </div>
          </div>

          {tab === 'signup' && (
            <div className="auth-field">
              <label>Account Role</label>
              <select value={role} onChange={(e) => setRole(e.target.value as any)}>
                <option value="rider">Rider (Book & Share Rides)</option>
                <option value="driver">Driver (Offer Planned Trips)</option>
                <option value="operator">Operator (Support Dispatch)</option>
              </select>
            </div>
          )}

          <button type="submit" disabled={busy} className="auth-submit-btn">
            {busy ? 'Please wait…' : tab === 'login' ? 'Sign In to Zew' : 'Create Account & Send Email'}
            <Icon name="arrow" size={16} />
          </button>
        </form>
      </div>
    </div>
  );
}
