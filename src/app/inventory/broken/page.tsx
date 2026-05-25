'use client';

import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import AuthGuard from '@/components/AuthGuard';
import BrokenItemsSystem from '@/components/BrokenItemsSystem';

function BrokenPageContent() {
  const searchParams = useSearchParams();
  const lab = searchParams.get('lab') ?? undefined;

  return (
    <AuthGuard>
      {() => <BrokenItemsSystem lab={lab} />}
    </AuthGuard>
  );
}

export default function BrokenItemsPage() {
  return (
    <Suspense>
      <BrokenPageContent />
    </Suspense>
  );
}
