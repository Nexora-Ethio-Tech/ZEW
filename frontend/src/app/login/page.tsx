'use client';

import { Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { AuthModal } from '@/features/auth/auth-modal';

function LoginContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const tab = searchParams.get('tab') === 'signup' ? 'signup' : 'login';

  return (
    <main>
      <AuthModal
        isOpen
        initialTab={tab}
        onClose={() => router.push('/')}
        onSuccess={(user) => router.push(user.role === 'driver' ? '/driver' : '/planned')}
      />
    </main>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginContent />
    </Suspense>
  );
}
