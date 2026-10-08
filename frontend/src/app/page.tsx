'use client';

import { useState, useEffect } from 'react';
import { Workspace } from '@/features/workspace';
import { LandingPage } from '@/features/landing/landing';
import { getStoredUser, clearAuthSession } from '@/lib/api';
import { applyTheme, getStoredTheme } from '@/lib/theme';

export default function Home() {
  const [user, setUser] = useState<{ id: string; email: string; name: string; role: string } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    applyTheme(getStoredTheme());
    const stored = getStoredUser();
    if (stored) {
      setUser(stored);
    }
    setLoading(false);
  }, []);

  if (loading) {
    return (
      <div style={{ display: 'flex', height: '100vh', alignItems: 'center', justifyContent: 'center', background: '#f8faf6', color: '#1b3d2b', fontFamily: 'sans-serif' }}>
        <h2>Loading Zew Addis Ababa…</h2>
      </div>
    );
  }

  if (!user) {
    return <LandingPage onAuthenticate={(user) => setUser(user)} />;
  }

  return (
    <Workspace
      user={user}
      onLogout={() => {
        clearAuthSession();
        setUser(null);
      }}
    />
  );
}
