import { createClient, SupabaseClient, PostgrestError } from '@supabase/supabase-js';

let _supabase: SupabaseClient | null = null;

function getSupabaseClient(): SupabaseClient {
  if (_supabase) return _supabase;

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error('Missing Supabase environment variables');
  }

  _supabase = createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
      storage: typeof window !== 'undefined' ? window.localStorage : undefined,
      flowType: 'pkce'
    }
  });

  return _supabase;
}

// Lazy proxy that only creates the client when actually used (not at import/build time)
export const supabase = new Proxy({} as SupabaseClient, {
  get(_target, prop) {
    const client = getSupabaseClient();
    const value = (client as unknown as Record<string | symbol, unknown>)[prop];
    if (typeof value === 'function') {
      return value.bind(client);
    }
    return value;
  },
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
