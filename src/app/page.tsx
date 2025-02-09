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
      try {
        console.log("=== Starting Session Check ===");
        
        // Get current session
        const { data: { session }, error: sessionError } = await supabase.auth.getSession();
        console.log("Session result:", { session, sessionError });

        if (sessionError) {
          console.error("Session error:", sessionError);
          return;
        }

        if (!mounted) return;

        if (session?.user) {
          setUser(session.user);
          console.log("Current User:", session.user);

          // Fetch profile
          const { data: profile, error: profileError } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', session.user.id)
            .maybeSingle();

          console.log("Profile query result:", { profile, profileError });

          if (profileError) {
            console.error("Profile error:", profileError);
            return;
          }

          if (!profile) {
            // Create profile if it doesn't exist
            const { data: newProfile, error: createError } = await supabase
              .from('profiles')
              .insert([
                {
                  id: session.user.id,
                  email: session.user.email,
                  role: 'pending',
                }
              ])
              .select('*')
              .single();

            console.log("New profile result:", { newProfile, createError });

            if (!createError && newProfile) {
              setUserRole(newProfile.role);
            }
          } else {
            setUserRole(profile.role);
          }
        }
      } catch (error) {
        console.error("Unexpected error:", error);
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    };

    // Set up auth state change listener
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (mounted) {
        checkSession();
      }
    });

    // Initial check
    checkSession();

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  console.log("Render state:", { loading, user, userRole });

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="text-lg">Loading...</div>
      </div>
    );
  }

  if (!user) {
    return <AuthForm />;
  }

  if (userRole === 'pending') {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="bg-white p-8 rounded-lg shadow-lg max-w-md w-full">
          <h2 className="text-2xl font-bold mb-4 text-center">Account Pending Approval</h2>
          <p className="text-gray-600 mb-4 text-center">
            Your email has been verified. Your account is now awaiting administrator approval. 
            You will be able to access the system once an admin approves your account.
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

  if (userRole === 'admin' || userRole === 'user') {
    return <InventorySystem />;
  }

  return (
    <div className="min-h-screen bg-gray-100 flex items-center justify-center">
      <div className="bg-white p-8 rounded-lg shadow-lg max-w-md w-full">
        <h2 className="text-2xl font-bold mb-4 text-center">Loading Account Status</h2>
        <p className="text-gray-600 mb-4 text-center">
          Please wait while we verify your account status...
        </p>
      </div>
    </div>
  );
}