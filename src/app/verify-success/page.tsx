'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { CheckCircle2 } from 'lucide-react';

export default function VerifySuccessPage() {
  const router = useRouter();

  useEffect(() => {
    // Optional: Add automatic redirect after 10 seconds
    const timer = setTimeout(() => {
      router.push('/');
    }, 10000);

    return () => clearTimeout(timer);
  }, [router]);

  return (
    <div className="min-h-screen bg-blue-50 flex items-center justify-center">
      <div className="bg-white p-8 rounded-lg shadow-lg max-w-md w-full text-center">
        <CheckCircle2 className="mx-auto w-16 h-16 text-green-500 mb-4" />
        <h2 className="text-2xl font-bold mb-4 text-gray-900">
          Email Verification Successful
        </h2>
        <p className="text-gray-600 mb-6">
          Your email has been verified. Your account is now awaiting administrator approval. 
          You will receive an email once your account has been reviewed.
        </p>
        <div className="flex justify-center gap-4">
          <button
            onClick={() => router.push('/')}
            className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600"
          >
            Return to Home
          </button>
        </div>
        <p className="text-sm text-gray-500 mt-4">
          You will be automatically redirected in 10 seconds
        </p>
      </div>
    </div>
  );
}