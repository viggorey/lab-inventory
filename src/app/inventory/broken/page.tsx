'use client';

import AuthGuard from '@/components/AuthGuard';
import BrokenItemsSystem from '@/components/BrokenItemsSystem';

export default function BrokenItemsPage() {
  return (
    <AuthGuard>
      {() => <BrokenItemsSystem />}
    </AuthGuard>
  );
}
