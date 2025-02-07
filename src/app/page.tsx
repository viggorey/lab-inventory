'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import AuthForm from '@/components/AuthForm';
import InventorySystem from '@/components/InventorySystem';
import type { User } from '@supabase/supabase-js';

export default function Home() {
  const [user, setUser] = useState<User | null>(null);
  const [userRole, setUserRole] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    const checkSession = async () => {
      console.log("=== Starting Session Check ===");
      try {
        const { data: { session } } = await supabase.auth.getSession();
        console.log("Session:", session);
        
        if (!mounted) {
          console.log("Component unmounted, stopping");
          return;
        }

        const currentUser = session?.user ?? null;
        console.log("Current User:", currentUser);
        setUser(currentUser);

        if (currentUser) {
          const { data: profile, error } = await supabase
            .from('profiles')
            .select('role')
            .eq('id', currentUser.id)
            .single();
          
          console.log("Profile Result:", { profile, error });

          if (mounted && profile) {
            console.log("Setting Role:", profile.role);
            setUserRole(profile.role);
          }
        }
      } catch (error) {
        console.error("Error:", error);
      } finally {
        if (mounted) {
          console.log("Setting loading to false");
          setLoading(false);
        }
      }
    };

    console.log("Initial State:", { loading, user, userRole });
    checkSession();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      console.log("Auth State Change:", { event, session });
      checkSession();
    });

    return () => {
      console.log("Cleanup");
      mounted = false;
      subscription.unsubscribe();
    };
}, []);



  // If loading, show loading screen
  console.log('Render state:', { loading, user, userRole });

  if (loading) {
    console.log('Showing loading screen');
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="text-lg">Loading...</div>
      </div>
    );
  }

  // If no user, show auth form
  if (!user) {
    return <AuthForm />;
  }

  // If user is pending, show pending screen
  if (userRole === 'pending') {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="bg-white p-8 rounded-lg shadow-lg max-w-md w-full">
          <h2 className="text-2xl font-bold mb-4 text-center">Account Pending Approval</h2>
          <p className="text-gray-600 mb-4 text-center">
            Your account is pending admin approval. Please check back later.
          </p>
          <button
            onClick={() => supabase.auth.signOut()}
            className="w-full bg-red-500 text-white px-4 py-2 rounded hover:bg-red-600"
          >
            Sign Out
          </button>
        </div>
      </div>
    );
  }

  // If user is approved (role is admin or user), show inventory system
  if (userRole === 'admin' || userRole === 'user') {
    return <InventorySystem />;
  }

  // Fallback for any other state
  return (
    <div className="min-h-screen bg-gray-100 flex items-center justify-center">
      <div className="text-lg">Checking access...</div>
    </div>
  );
}