'use client';

import { useState } from 'react';
import { supabase } from '@/lib/supabase';
import type { AuthError } from '@supabase/supabase-js';

const AuthForm = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [isLogin, setIsLogin] = useState(true);

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage('');
  
    try {
      if (isLogin) {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (error) throw error;
        // In AuthForm.tsx, update the signup section
      } else {
            const { data: { user }, error: signUpError } = await supabase.auth.signUp({
            email,
            password,
            });
        
            if (signUpError) throw signUpError;
        
            if (user) {
            try {
                // Explicitly create a profile with pending status
                const { error: profileError } = await supabase
                .from('profiles')
                .insert([
                    {
                    id: user.id,
                    email: user.email,
                    role: 'pending',  // Make sure this is 'pending'
                    created_at: new Date().toISOString()
                    }
                ]);
        
                if (profileError) {
                console.error('Profile creation error:', profileError);
                // If profile creation fails, try to delete the auth user
                await supabase.auth.admin.deleteUser(user.id);
                throw new Error('Failed to create user profile. Please try again.');
                }
                
                setMessage('Sign up successful! Please wait for admin approval. You will not be able to access the system until an admin approves your account.');
            } catch (error) {
                console.error('Profile creation error:', error);
                throw new Error('Failed to complete signup process. Please try again.');
            }
            }
        }
    } catch (error: unknown) {
      const authError = error as AuthError;
      setMessage(authError.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-100">
      <div className="w-full max-w-md">
        <form onSubmit={handleAuth} className="bg-white shadow-lg rounded px-8 pt-6 pb-8 mb-4">
          <h2 className="text-2xl font-bold mb-6 text-center">
            {isLogin ? 'Login' : 'Sign Up'} to Lab Inventory
          </h2>
          
          <div className="mb-4">
            <label className="block text-gray-700 text-sm font-bold mb-2" htmlFor="email">
              Email
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
              required
            />
          </div>

          <div className="mb-6">
            <label className="block text-gray-700 text-sm font-bold mb-2" htmlFor="password">
              Password
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
              required
            />
          </div>

          {message && (
            <div className="mb-4 text-sm text-center text-red-500">
              {message}
            </div>
          )}

          <div className="flex flex-col gap-4">
            <button
              type="submit"
              className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded focus:outline-none focus:shadow-outline w-full"
              disabled={loading}
            >
              {loading ? 'Loading...' : isLogin ? 'Login' : 'Sign Up'}
            </button>
            
            <button
              type="button"
              className="text-blue-500 hover:text-blue-800 text-sm text-center"
              onClick={() => setIsLogin(!isLogin)}
            >
              {isLogin ? "Don't have an account? Sign Up" : 'Already have an account? Login'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default AuthForm;