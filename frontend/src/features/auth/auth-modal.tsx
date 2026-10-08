'use client';

import { useState } from 'react';
import { Icon } from '@/components/icon';
import { setAuthSession } from '@/lib/api';

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
  const [name, setName] = useState('');
  const [role, setRole] = useState<'rider' | 'driver' | 'operator'>('rider');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);

    try {
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
      onSuccess(data.user);
      onClose();
    } catch (err: any) {
      setError(err.message || 'An error occurred.');
    } finally {
      setBusy(false);
    }
  }

  async function quickLogin(presetEmail: string) {
    setError(null);
    setBusy(true);
    try {
      const res = await fetch('/api/v1/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: presetEmail, password: 'password123' }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Quick login failed');

      setAuthSession(data.token, data.user);
      onSuccess(data.user);
      onClose();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
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
            <input
              type="password"
              required
              placeholder="Enter password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
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
            {busy ? 'Please wait…' : tab === 'login' ? 'Sign In to Zew' : 'Create Account'}
            <Icon name="arrow" size={16} />
          </button>
        </form>
      </div>
    </div>
  );
}
