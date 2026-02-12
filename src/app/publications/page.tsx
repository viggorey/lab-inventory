'use client';

import dynamic from 'next/dynamic';
import AuthGuard from '@/components/AuthGuard';

const PublicationsSystem = dynamic(() => import('@/components/publications/PublicationsSystem'), { ssr: false });

export default function PublicationsPage() {
  return (
    <AuthGuard>
      {({ isAdmin }) => <PublicationsSystem isAdmin={isAdmin} />}
    </AuthGuard>
  );
}
