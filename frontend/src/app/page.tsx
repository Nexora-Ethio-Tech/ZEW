'use client';
import { Suspense, useEffect, useState } from 'react';
import { LandingPage } from '@/features/landing/landing';
import { PoolWorkspace } from '@/features/pool/pool-workspace';
import { restoreAccount, type Account } from '@/lib/auth';

export default function Home() {
  const [user, setUser] = useState<Account | null>(null);
  const [error, setError] = useState('');
  useEffect(() => {
    let active = true;
    restoreAccount()
      .then((account) => {
        if (active) setUser(account);
      })
      .catch(() => {
        if (active) setError('We could not restore your sign-in. Please sign in again.');
      });
    return () => {
      active = false;
    };
  }, []);
  if (user)
    return (
      <Suspense fallback={<p role="status">Opening your workspace…</p>}>
        <PoolWorkspace />
      </Suspense>
    );
  return <LandingPage onAuthenticate={setUser} accountError={error} />;
}
