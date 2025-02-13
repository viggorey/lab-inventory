'use client';

import dynamic from 'next/dynamic';
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';  
import type { User } from '@supabase/supabase-js';

const AuthForm = dynamic(() => import('@/components/AuthForm'), { ssr: false });
const InventorySystem = dynamic(() => import('@/components/InventorySystem'), { ssr: false });
const PendingApproval = dynamic(() => import('@/components/PendingApproval'), { ssr: false });

function LoadingState() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-50 flex items-center justify-center">
      <div className="text-lg text-gray-600">Loading...</div>
    </div>
  );
}

export default function Home() {
  const [isClient, setIsClient] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [userRole, setUserRole] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setIsClient(true);
  }, []);

  useEffect(() => {
    if (!isClient) return;

    let mounted = true;

    const checkSession = async () => {
      try {
        // First check the session
        const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
        
        if (sessionError) {
          console.error("Session error:", sessionError);
          setError("Session error: " + sessionError.message);
          return;
        }

        if (!sessionData.session) {
          setUser(null);
          setLoading(false);
          return;
        }

        const { data: userData, error: userError } = await supabase.auth.getUser();
        
        if (userError) {
          console.error("User error:", userError);
          setError("User error: " + userError.message);
          return;
        }

        if (!mounted) return;

        // In checkSession function
        if (userData.user) {
          setUser(userData.user);
          try {
            // Check if profile exists
            const { data: profile, error: profileError } = await supabase
              .from('profiles')
              .select('*')
              .eq('id', userData.user.id)
              .single();

            if (!profile && !profileError) {
              // Create profile if it doesn't exist
              const { data: newProfile, error: createError } = await supabase
                .from('profiles')
                .insert([
                  {
                    id: userData.user.id,
                    email: userData.user.email,
                    role: 'pending'
                  }
                ])
                .select()
                .single();

              if (createError) throw createError;
              if (newProfile) setUserRole(newProfile.role);
            } else if (profile) {
              setUserRole(profile.role);
            }
          } catch (error) {
            console.error("Profile error:", error);
            setError("Profile error: " + (error as Error).message);
          }
        }
      } catch (error) {
        console.error("Unexpected error:", error);
        setError("Unexpected error: " + (error as Error).message);
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    };

    checkSession();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(() => {
      if (mounted) {
        checkSession();
      }
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [isClient]);

  if (!isClient || loading) {
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
    return <InventorySystem />;
  }

  return <LoadingState />;
}