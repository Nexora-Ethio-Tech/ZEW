'use client';

import { useRouter } from 'next/navigation';
import { AuthModal } from '@/features/auth/auth-modal';

export default function LoginPage() {
  const router = useRouter();

  return (
    <main>
      <AuthModal
        isOpen
        onClose={() => router.push('/')}
        onSuccess={(user) => router.push(user.role === 'driver' ? '/driver' : '/planned')}
      />
    </main>
  );
}
