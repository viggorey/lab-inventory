'use client';

import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'next/navigation';

export default function VerifyEmail() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [message, setMessage] = useState('Verifying your email...');

  useEffect(() => {
    const verifyEmail = async () => {
      const token = searchParams.get('token');
      
      if (!token) {
        setMessage('Invalid verification link');
        return;
      }

      try {
        // Find the user with this verification token
        const { data, error } = await supabase
          .from('profiles')
          .update({ 
            email_verified: true,
            verification_token: null 
          })
          .eq('verification_token', token)
          .select()
          .single();

        if (error) throw error;

        if (data) {
          setMessage('Email verified successfully! You can now close this page.');
          setTimeout(() => {
            router.push('/');
          }, 3000);
        } else {
          setMessage('Invalid or expired verification link');
        }
      } catch (error) {
        console.error('Verification error:', error);
        setMessage('Failed to verify email. Please try again.');
      }
    };

    if (searchParams.get('token')) {
      verifyEmail();
    }
  }, [searchParams, router]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-50 flex items-center justify-center p-6">
      <div className="bg-white rounded-xl shadow-lg p-8 max-w-md w-full">
        <h1 className="text-2xl font-bold text-center mb-4">Email Verification</h1>
        <p className="text-center text-gray-600">{message}</p>
      </div>
    </div>
  );
}