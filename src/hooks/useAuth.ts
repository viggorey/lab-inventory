'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import type { User } from '@supabase/supabase-js';

export type UserRole = 'admin' | 'user' | 'pending' | 'denied' | null;

interface AuthState {
  user: User | null;
  userRole: UserRole;
  loading: boolean;
  error: string | null;
  isAdmin: boolean;
  isAuthenticated: boolean;
}

export function useAuth() {
  const [state, setState] = useState<AuthState>({
    user: null,
    userRole: null,
    loading: true,
    error: null,
    isAdmin: false,
    isAuthenticated: false,
  });

  // Track whether initial load has completed so that subsequent auth
  // refreshes (e.g. token refresh on tab focus) don't show the loading
  // spinner and unmount the current page components.
  const initialLoadDone = useRef(false);

  const checkSession = useCallback(async () => {
    try {
      // Only show the loading spinner on the very first check.
      // Subsequent checks (e.g. triggered by onAuthStateChange when the
      // user returns to the tab) run silently so form state is preserved.
      if (!initialLoadDone.current) {
        setState(prev => ({ ...prev, loading: true, error: null }));
      }

      const { data: sessionData, error: sessionError } = await supabase.auth.getSession();

      if (sessionError) throw sessionError;

      if (!sessionData.session) {
        setState({
          user: null,
          userRole: null,
          loading: false,
          error: null,
          isAdmin: false,
          isAuthenticated: false,
        });
        initialLoadDone.current = true;
        return;
      }

      const { data: userData, error: userError } = await supabase.auth.getUser();

      if (userError) throw userError;

      if (userData.user) {
        // Check for existing profile
        const { data: profile, error: profileError } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', userData.user.id)
          .single();

        let role: UserRole = null;

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
            role = newProfile.role as UserRole;
          }
        } else if (profile) {
          role = profile.role as UserRole;
        }

        setState({
          user: userData.user,
          userRole: role,
          loading: false,
          error: null,
          isAdmin: role === 'admin',
          isAuthenticated: role === 'admin' || role === 'user',
        });
        initialLoadDone.current = true;
      }
    } catch (error) {
      console.error('Session check error:', error);
      setState(prev => ({
        ...prev,
        loading: false,
        error: error instanceof Error ? error.message : 'An unexpected error occurred',
      }));
      initialLoadDone.current = true;
    }
  }, []);

  const signOut = useCallback(async () => {
    try {
      const { error } = await supabase.auth.signOut();
      if (error) {
        console.error('Error signing out:', error);
        return;
      }
      window.location.href = '/';
    } catch (error) {
      console.error('Unexpected error during sign out:', error);
    }
  }, []);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(() => {
      checkSession();
    });

    checkSession();

    return () => {
      subscription.unsubscribe();
    };
  }, [checkSession]);

  return {
    ...state,
    signOut,
    refreshAuth: checkSession,
  };
}
