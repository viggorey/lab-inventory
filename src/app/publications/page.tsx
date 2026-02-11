'use client';

import dynamic from 'next/dynamic';
import { useAuth } from '@/hooks/useAuth';
import Navigation from '@/components/layout/Navigation';

const AuthForm = dynamic(() => import('@/components/AuthForm'), { ssr: false });
const PendingApproval = dynamic(() => import('@/components/PendingApproval'), { ssr: false });
const PublicationsSystem = dynamic(() => import('@/components/publications/PublicationsSystem'), { ssr: false });

function LoadingState() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-50 flex items-center justify-center">
      <div className="text-lg text-gray-600">Loading...</div>
    </div>
  );
}

export default function PublicationsPage() {
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
          <PublicationsSystem isAdmin={isAdmin} />
        </div>
      </div>
    );
  }

  return <LoadingState />;
}
