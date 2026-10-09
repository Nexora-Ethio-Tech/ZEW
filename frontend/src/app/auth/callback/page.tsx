'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getSupabase } from '@/lib/supabase';
import { establishSession } from '@/lib/auth';

export default function AuthCallback() {
  const router = useRouter();
  const [error, setError] = useState('');
  useEffect(() => {
    let active = true;
    async function complete() {
      const { data, error } = await getSupabase().auth.getSession();
      if (error || !data.session)
        throw new Error(
          'This confirmation link has expired or was already used. Sign in, or resend your confirmation email.',
        );
      const account = await establishSession(data.session);
      if (active) router.replace(account.role === 'driver' ? '/driver' : '/planned');
    }
    void complete().catch((e) => {
      if (active) setError(e.message);
    });
    return () => {
      active = false;
    };
  }, [router]);
  return (
    <main className="route-loading">
      {error ? (
        <>
          <p role="alert">{error}</p>
          <a href="/login">Back to sign in</a>
        </>
      ) : (
        <p role="status">Confirming your email and opening your account…</p>
      )}
    </main>
  );
}
