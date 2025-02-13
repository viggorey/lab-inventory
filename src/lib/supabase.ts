import { createClient, PostgrestError } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  // Only throw error in client-side code
  if (typeof window !== 'undefined') {
    throw new Error('Missing Supabase environment variables');
  }
}

export const supabase = createClient(
  supabaseUrl || '',
  supabaseAnonKey || '',
  {
    auth: {
      persistSession: true,
      storageKey: 'lab-inventory-auth',
      autoRefreshToken: true,
      detectSessionInUrl: true,
      storage: typeof window !== 'undefined' ? window.localStorage : undefined
    }
  }
);

// Add error handling wrapper
export const handleSupabaseError = (error: PostgrestError | null) => {
  if (error) {
    console.error('Supabase Error:', {
      message: error.message,
      details: error.details,
      hint: error.hint,
      code: error.code
    });
    return error.message;
  }
  return null;
};