'use client';
import { useEffect, useState } from 'react';
import { LandingPage } from '@/features/landing/landing';
import { restoreAccount, type Account } from '@/lib/auth';
import { useRouter } from 'next/navigation';

export default function Home() {
  const router = useRouter();
  const [user, setUser] = useState<Account | null>(null);
  const [error, setError] = useState('');
  useEffect(() => {
    if (user) router.replace(user.role === 'driver' ? '/driver' : '/rides');
  }, [user, router]);
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
      <p className="route-loading" role="status">
        Opening your workspace…
      </p>
    );
  return <LandingPage onAuthenticate={setUser} accountError={error} />;
}
