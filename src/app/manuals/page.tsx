'use client';

import dynamic from 'next/dynamic';
import AuthGuard from '@/components/AuthGuard';

const ManualsSystem = dynamic(() => import('@/components/manuals/ManualsSystem'), { ssr: false });

export default function ManualsPage() {
  return (
    <AuthGuard>
      {({ isAdmin }) => <ManualsSystem isAdmin={isAdmin} />}
    </AuthGuard>
  );
}
