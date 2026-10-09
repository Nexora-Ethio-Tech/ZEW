'use client';
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { restoreAccount, type Account } from '@/lib/auth';

const PassengerAccount = createContext<Account | null>(null);
export const usePassengerAccount = () => useContext(PassengerAccount);

export function PassengerAccess({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [account, setAccount] = useState<Account | null>(null);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => {
    let active = true;
    restoreAccount()
      .then((account) => {
        if (!active) return;
        if (account?.role === 'driver') router.replace('/driver');
        else {
          setAccount(account);
          setReady(true);
        }
      })
      .catch(() => {
        if (active) setError('Could not verify your account. Please sign in again.');
      });
    return () => {
      active = false;
    };
  }, [router]);
  if (error)
    return (
      <main className="route-loading">
        <p role="alert">{error}</p>
        <a href="/login">Sign in</a>
      </main>
    );
  return ready ? (
    <PassengerAccount.Provider value={account}>{children}</PassengerAccount.Provider>
  ) : (
    <p className="route-loading" role="status">
      Opening your workspace…
    </p>
  );
}
