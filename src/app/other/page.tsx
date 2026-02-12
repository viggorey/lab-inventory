'use client';

import dynamic from 'next/dynamic';
import AuthGuard from '@/components/AuthGuard';

const OtherSystem = dynamic(() => import('@/components/other/OtherSystem'), { ssr: false });

export default function OtherPage() {
  return (
    <AuthGuard>
      {({ isAdmin }) => <OtherSystem isAdmin={isAdmin} />}
    </AuthGuard>
  );
}
