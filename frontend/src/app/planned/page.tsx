import Link from 'next/link';
import { Workspace } from '@/features/workspace';
export default function PlannedPage() {
  return (
    <>
      <Link
        href="/"
        style={{
          position: 'fixed',
          bottom: 12,
          right: 16,
          zIndex: 30,
          background: '#285943',
          color: '#fff',
          padding: '12px 18px',
          borderRadius: 20,
          fontSize: 12,
        }}
      >
        ← Back to ride circles
      </Link>
      <Workspace />
    </>
  );
}
