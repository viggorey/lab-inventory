import { createClient, SupabaseClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabaseServiceKey = process.env.NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables');
}

// Using proper TypeScript declaration merging for global
declare global {
  var supabase: SupabaseClient | undefined;
  var supabaseAdmin: SupabaseClient | undefined;
}

// Create clients only if they haven't been created yet
export const supabase = globalThis.supabase || createClient(supabaseUrl, supabaseAnonKey);
export const supabaseAdmin = supabaseServiceKey 
  ? (globalThis.supabaseAdmin || createClient(supabaseUrl, supabaseServiceKey))
  : null;

// For development/hot reloading support
if (process.env.NODE_ENV !== 'production') {
  globalThis.supabase = supabase;
  if (supabaseAdmin) globalThis.supabaseAdmin = supabaseAdmin;
}