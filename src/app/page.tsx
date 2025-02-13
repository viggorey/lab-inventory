'use client';

import dynamic from 'next/dynamic';
import { useEffect, useState, useCallback } from 'react';
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

  const checkSession = useCallback(async () => {
    try {
      console.log('Starting check session...');
      setLoading(true);
  
      const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
      console.log('Session check:', { sessionData, sessionError });
      
      if (sessionError) throw sessionError;
  
      if (!sessionData.session) {
        console.log('No active session');
        setUser(null);
        setUserRole(null);
        return;
      }
  
      const { data: userData, error: userError } = await supabase.auth.getUser();
      console.log('User data:', userData);
      
      if (userError) throw userError;
  
      if (userData.user) {
        setUser(userData.user);
        
        // Check for existing profile
        const { data: profile, error: profileError } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', userData.user.id)
          .single();
  
        // If no profile exists and no error (meaning profile just doesn't exist yet)
        if (!profile && !profileError) {
          // Create profile
          const { data: newProfile, error: createError } = await supabase
            .from('profiles')
            .insert([{
              id: userData.user.id,
              email: userData.user.email,
              role: 'pending',
              created_at: new Date().toISOString()
            }])
            .select()
            .single();
  
          if (createError) throw createError;
          
          if (newProfile) {
            setUserRole(newProfile.role);
          }
        } else if (profile) {
          setUserRole(profile.role);
        }
      }
    } catch (error) {
      console.error('Session check error:', error);
      setError(error instanceof Error ? error.message : 'An unexpected error occurred');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    setIsClient(true);
  }, []);

  useEffect(() => {
    if (!isClient) return;

    let mounted = true;

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
  }, [isClient, checkSession]);

  useEffect(() => {
    console.log('User role changed:', userRole);
  }, [userRole]);

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