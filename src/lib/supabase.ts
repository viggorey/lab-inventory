import { createClient, PostgrestError } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    storageKey: 'lab-inventory-auth',
    autoRefreshToken: true,
    detectSessionInUrl: true,
    storage: typeof window !== 'undefined' ? window.localStorage : undefined
  },
  db: {
    schema: 'public'
  },
  global: {
    headers: {
      'x-my-custom-header': 'lab-inventory'
    }
  }
});

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