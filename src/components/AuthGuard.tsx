'use client';

import { type ReactNode } from 'react';
import dynamic from 'next/dynamic';
import { useAuth } from '@/hooks/useAuth';
import Navigation from '@/components/layout/Navigation';

const AuthForm = dynamic(() => import('@/components/AuthForm'), { ssr: false });
const PendingApproval = dynamic(() => import('@/components/PendingApproval'), { ssr: false });

function LoadingState() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-50 flex items-center justify-center">
      <div className="flex flex-col items-center gap-3">
        <div className="w-8 h-8 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin" />
        <div className="text-sm text-gray-500">Loading...</div>
      </div>
    </div>
  );
}

interface AuthGuardProps {
  children: (props: { isAdmin: boolean }) => ReactNode;
}

export default function AuthGuard({ children }: AuthGuardProps) {
  const { user, userRole, loading, error, isAdmin, signOut } = useAuth();

  if (loading) {
    return <LoadingState />;
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-50 flex items-center justify-center">
        <div className="bg-white rounded-xl shadow-lg p-8 max-w-md">
          <h2 className="text-2xl font-bold text-red-600 mb-4">Error Occurred</h2>
          <p className="text-gray-600 mb-4">{error}</p>
          <button
            onClick={() => window.location.reload()}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  if (!user) {
    return <AuthForm />;
  }

  if (userRole === 'pending') {
    return <PendingApproval />;
  }

  if (userRole === 'admin' || userRole === 'user') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-50 p-6">
        <div className="max-w-7xl mx-auto">
          <Navigation isAdmin={isAdmin} onLogout={signOut} />
          {children({ isAdmin })}
        </div>
      </div>
    );
  }

  return <LoadingState />;
}
