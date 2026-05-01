'use client';

import { useState } from 'react';
import dynamic from 'next/dynamic';
import AuthGuard from '@/components/AuthGuard';
import { Box } from 'lucide-react';

const InventorySystem = dynamic(() => import('@/components/InventorySystem'), { ssr: false });

export default function InventoryPage() {
  return (
    <AuthGuard>
      {() => <InventoriesHub />}
    </AuthGuard>
  );
}

function InventoriesHub() {
  const [tab, setTab] = useState<'main' | 'brunei'>('main');

  return (
    <div>
      <div className="flex border-b border-gray-200 mb-6">
        {([
          { id: 'main', label: 'Main Lab' },
          { id: 'brunei', label: 'Brunei' },
        ] as const).map(({ id, label }) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className={`flex items-center gap-2 px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              tab === id
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            <Box className="w-4 h-4" />
            {label}
          </button>
        ))}
      </div>
      {tab === 'main' && <InventorySystem lab="main" />}
      {tab === 'brunei' && <InventorySystem lab="brunei" />}
    </div>
  );
}
