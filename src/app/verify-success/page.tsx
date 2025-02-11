'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { CheckCircle2, Box, Loader } from 'lucide-react';

export default function VerifySuccessPage() {
  const router = useRouter();

  useEffect(() => {
    const timer = setTimeout(() => {
      router.push('/');
    }, 10000);

    return () => clearTimeout(timer);
  }, [router]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-50 flex items-center justify-center p-6">
      <div className="w-full max-w-md">
        <div className="bg-white rounded-xl shadow-lg p-8">
          {/* Header */}
          <div className="flex items-center gap-3 justify-center mb-8">
            <div className="bg-blue-600 p-2 rounded-lg">
              <Box className="w-6 h-6 text-white" />
            </div>
            <h1 className="text-2xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
              Lab Inventory System
            </h1>
          </div>

          {/* Success Message */}
          <div className="text-center space-y-6">
            <div className="flex justify-center">
              <div className="bg-green-100 p-3 rounded-full">
                <CheckCircle2 className="w-12 h-12 text-green-600" />
              </div>
            </div>
            
            <div className="space-y-2">
              <h2 className="text-2xl font-semibold text-gray-900">
                Email Verified Successfully
              </h2>
              <p className="text-gray-600">
                Thank you for verifying your email. Your account is now awaiting administrator approval.
              </p>
            </div>

            <div className="space-y-4">
              <button
                onClick={() => router.push('/')}
                className="w-full bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
              >
                Return to Login
              </button>

              <div className="flex items-center gap-2 justify-center text-sm text-gray-500">
                <Loader className="w-4 h-4 animate-spin" />
                <span>Redirecting in 10 seconds...</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}