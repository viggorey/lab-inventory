import { createClient } from '@supabase/supabase-js';
import { NextRequest } from 'next/server';

/**
 * Auth helper for API routes.
 *
 * Sessions live in localStorage (PKCE), not cookies, so a route handler cannot
 * read the session from the request on its own. The client sends its access
 * token in the Authorization header instead, and we verify it here before any
 * service-role work is done.
 */

export function getAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

function getAnonClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}

export interface AuthResult {
  ok: boolean;
  status: number;
  error?: string;
  userId?: string;
}

/**
 * Verify the caller is signed in and has the admin role.
 * Returns a result rather than throwing so handlers can shape their own response.
 */
export async function requireAdmin(request: NextRequest): Promise<AuthResult> {
  const header = request.headers.get('authorization') ?? '';
  const token = header.toLowerCase().startsWith('bearer ')
    ? header.slice(7).trim()
    : '';

  if (!token) {
    return { ok: false, status: 401, error: 'Not authenticated' };
  }

  // Validate the token against Supabase Auth.
  const { data, error } = await getAnonClient().auth.getUser(token);
  if (error || !data.user) {
    return { ok: false, status: 401, error: 'Not authenticated' };
  }

  // Role lives in profiles; check it with the service-role client so the
  // lookup cannot be blocked by RLS.
  const { data: profile, error: profileError } = await getAdminClient()
    .from('profiles')
    .select('role')
    .eq('id', data.user.id)
    .single();

  if (profileError || profile?.role !== 'admin') {
    return { ok: false, status: 403, error: 'Admin access required' };
  }

  return { ok: true, status: 200, userId: data.user.id };
}
