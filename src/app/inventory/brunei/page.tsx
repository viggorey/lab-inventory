'use client';

import dynamic from 'next/dynamic';
import AuthGuard from '@/components/AuthGuard';

const InventorySystem = dynamic(() => import('@/components/InventorySystem'), { ssr: false });

export default function BruneiInventoryPage() {
  return (
    <AuthGuard>
      {() => <InventorySystem lab="brunei" />}
    </AuthGuard>
  );
}
