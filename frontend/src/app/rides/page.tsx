import { Suspense } from 'react';
import { PoolWorkspace } from '@/features/pool/pool-workspace';
import { PassengerAccess } from '@/features/auth/passenger-access';

export default function RidesPage() {
  return (
    <Suspense fallback={<p className="route-loading" role="status">Opening your ride workspace…</p>}>
      <PassengerAccess><PoolWorkspace /></PassengerAccess>
    </Suspense>
  );
}
