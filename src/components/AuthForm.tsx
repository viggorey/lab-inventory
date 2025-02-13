'use client';

import { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { Box, Mail, Lock, Loader } from 'lucide-react';

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
        const { data: _, error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
  
        if (error) {
          setMessage(error.message);
          return;
        }
      } else {
        console.log('Starting signup process...');
        
        // Sign up without email verification
        const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
          email,
          password
        });
  
        console.log('Signup result:', { signUpData, signUpError });
    
        if (signUpError) {
          console.error('Signup error:', signUpError);
          setMessage(signUpError.message);
          return;
        }
    
        if (signUpData?.user) {
          try {
            // Create profile immediately
            const { error: profileError } = await supabase
              .from('profiles')
              .insert({
                id: signUpData.user.id,
                email: signUpData.user.email,
                role: 'pending',
                created_at: new Date().toISOString()
              });
  
            if (profileError) {
              console.error('Profile creation error:', profileError);
              throw profileError;
            }
            
            setMessage(
              'Account created successfully! Please wait for administrator approval.'
            );
          } catch (error) {
            console.error('Profile creation error:', error);
            setMessage('Account created but profile setup failed. Please contact support.');
          }
        }
      }
    } catch (error) {
      console.error('Auth error:', error);
      setMessage('An unexpected error occurred. Please try again.');
    } finally {
      setLoading(false);
    }
  };


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
          
          <h2 className="text-xl font-semibold text-gray-900 text-center mb-6">
            {isLogin ? 'Welcome Back' : 'Create Account'}
          </h2>
          
          <form onSubmit={handleAuth} className="space-y-6">
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="email">
                  Email
                </label>
                <div className="relative">
                  <Mail className="w-5 h-5 text-gray-400 absolute left-3 top-1/2 transform -translate-y-1/2" />
                  <input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="pl-10 pr-4 py-2 w-full border rounded-lg text-gray-700 focus:ring-2 focus:ring-blue-200 focus:border-blue-500 transition-all"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="password">
                  Password
                </label>
                <div className="relative">
                  <Lock className="w-5 h-5 text-gray-400 absolute left-3 top-1/2 transform -translate-y-1/2" />
                  <input
                    id="password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="pl-10 pr-4 py-2 w-full border rounded-lg text-gray-700 focus:ring-2 focus:ring-blue-200 focus:border-blue-500 transition-all"
                    required
                  />
                </div>
              </div>
            </div>

            {message && (
              <div className={`p-4 rounded-lg ${
                message.includes('successfully') || message.includes('verify')
                  ? 'bg-green-50 text-green-700 border border-green-200'
                  : message.includes('Invalid') 
                  ? 'bg-yellow-50 text-yellow-700 border border-yellow-200'
                  : 'bg-red-50 text-red-700 border border-red-200'
              }`}>
                {message}
              </div>
            )}

            <div className="space-y-4">
              <button
                type="submit"
                disabled={loading}
                className="w-full bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
              >
                {loading ? (
                  <>
                    <Loader className="w-4 h-4 animate-spin" />
                    {isLogin ? 'Signing in...' : 'Creating account...'}
                  </>
                ) : (
                  <>{isLogin ? 'Sign In' : 'Create Account'}</>
                )}
              </button>
              
              <button
                type="button"
                className="w-full text-blue-600 hover:text-blue-700 text-sm transition-colors"
                onClick={() => setIsLogin(!isLogin)}
              >
                {isLogin 
                  ? "Don't have an account? Sign Up" 
                  : 'Already have an account? Sign In'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default AuthForm;