import { Suspense } from 'react';
import { PoolWorkspace } from '@/features/pool/pool-workspace';
export default function DemoPage() {
  return (
    <Suspense
      fallback={
        <p className="route-loading" role="status">
          Opening your private demo…
        </p>
      }
    >
      <PoolWorkspace />
    </Suspense>
  );
}
