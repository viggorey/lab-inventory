-- ============================================================================
-- MIGRATION: restrict data access to approved users
-- Run this in the Supabase SQL Editor. Safe to re-run.
--
-- Why: several policies granted access to any authenticated user, and one
-- granted access to the `public` role (i.e. no login at all). Registration is
-- open, so "any authenticated user" includes anyone on the internet who has
-- signed up and is still sitting in `pending`.
--
-- Fixed here:
--   1. profiles UPDATE was `USING (true)` for all authenticated users, so any
--      logged-in user could set their own role to 'admin'. Privilege escalation.
--   2. inventory_logs SELECT was `USING (true)` for role `public`, so the audit
--      log — including every user's email address — was readable with only the
--      anon key, without logging in at all.
--   3. inventory had a permissive ALL policy for approved users. Because
--      permissive policies are OR-ed, that granted INSERT/UPDATE/DELETE to
--      non-admin users despite the admin-only policies alongside it.
--   4. Every other SELECT policy used `TO authenticated USING (true)`, letting
--      pending and denied accounts read inventory, manuals, publications,
--      links, sites, bookings and all stored files.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- Helper functions
--
-- SECURITY DEFINER so they bypass RLS when reading `profiles`. This matters:
-- a policy ON profiles that itself SELECTs from profiles causes infinite
-- recursion, so the admin check has to live outside the policy system.
-- ----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'
  );
$$;

CREATE OR REPLACE FUNCTION public.is_approved()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid() AND role IN ('admin', 'user')
  );
$$;

REVOKE EXECUTE ON FUNCTION public.is_admin() FROM anon;
REVOKE EXECUTE ON FUNCTION public.is_approved() FROM anon;
GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_approved() TO authenticated;

-- ----------------------------------------------------------------------------
-- profiles
--
-- Treated differently from every other table: a pending user MUST still be able
-- to read their own row, because that is how the app discovers their role and
-- decides to show the "awaiting approval" screen. Locking this to approved
-- users only would break the approval flow entirely.
-- ----------------------------------------------------------------------------

DROP POLICY IF EXISTS "profiles_basic_select_policy" ON profiles;
DROP POLICY IF EXISTS "profiles_basic_update_policy" ON profiles;
DROP POLICY IF EXISTS "profiles_basic_insert_policy" ON profiles;

-- Read your own row; admins read everyone (User Management needs the list).
CREATE POLICY "Read own profile or admin reads all"
  ON profiles FOR SELECT
  TO authenticated
  USING (id = auth.uid() OR public.is_admin());

-- Sign-up creates exactly one row, for yourself, always as 'pending'.
-- This is what stops a new account granting itself a role.
CREATE POLICY "Create own profile as pending"
  ON profiles FOR INSERT
  TO authenticated
  WITH CHECK (id = auth.uid() AND role = 'pending');

-- Only admins change roles.
CREATE POLICY "Admins update profiles"
  ON profiles FOR UPDATE
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- ----------------------------------------------------------------------------
-- inventory
--
-- The old ALL policy is replaced by a SELECT-only policy; the existing
-- admin-only INSERT/UPDATE/DELETE policies are left in place and now actually
-- bind, because nothing permissive sits beside them any more.
-- ----------------------------------------------------------------------------

DROP POLICY IF EXISTS "Enable access for approved users only" ON inventory;

CREATE POLICY "Approved users can view inventory"
  ON inventory FOR SELECT
  TO authenticated
  USING (public.is_approved());

-- ----------------------------------------------------------------------------
-- inventory_logs — was world-readable, including user_email
-- ----------------------------------------------------------------------------

DROP POLICY IF EXISTS "Allow users to view logs" ON inventory_logs;

CREATE POLICY "Approved users can view logs"
  ON inventory_logs FOR SELECT
  TO authenticated
  USING (public.is_approved());

-- ----------------------------------------------------------------------------
-- inventory_bookings
-- ----------------------------------------------------------------------------

DROP POLICY IF EXISTS "View bookings" ON inventory_bookings;

CREATE POLICY "Approved users can view bookings"
  ON inventory_bookings FOR SELECT
  TO authenticated
  USING (public.is_approved());

-- ----------------------------------------------------------------------------
-- Remaining content tables
-- ----------------------------------------------------------------------------

DROP POLICY IF EXISTS "Authenticated users can view manuals" ON manuals;
CREATE POLICY "Approved users can view manuals"
  ON manuals FOR SELECT TO authenticated USING (public.is_approved());

DROP POLICY IF EXISTS "Authenticated users can view manual_equipment" ON manual_equipment;
CREATE POLICY "Approved users can view manual_equipment"
  ON manual_equipment FOR SELECT TO authenticated USING (public.is_approved());

DROP POLICY IF EXISTS "Authenticated users can view publications" ON publications;
CREATE POLICY "Approved users can view publications"
  ON publications FOR SELECT TO authenticated USING (public.is_approved());

DROP POLICY IF EXISTS "Authenticated users can view categories" ON publication_categories;
CREATE POLICY "Approved users can view categories"
  ON publication_categories FOR SELECT TO authenticated USING (public.is_approved());

DROP POLICY IF EXISTS "Authenticated users can view shared_links" ON shared_links;
CREATE POLICY "Approved users can view shared_links"
  ON shared_links FOR SELECT TO authenticated USING (public.is_approved());

DROP POLICY IF EXISTS "auth users view sites" ON sites;
CREATE POLICY "Approved users can view sites"
  ON sites FOR SELECT TO authenticated USING (public.is_approved());

DROP POLICY IF EXISTS "authenticated_read_site_logs" ON site_logs;
CREATE POLICY "Approved users can view site_logs"
  ON site_logs FOR SELECT TO authenticated USING (public.is_approved());

-- ----------------------------------------------------------------------------
-- Storage buckets
--
-- Without this, a pending account can mint a signed URL for the manuals archive
-- and every publication PDF.
-- ----------------------------------------------------------------------------

DROP POLICY IF EXISTS "Authenticated users can view manuals files" ON storage.objects;
CREATE POLICY "Approved users can view manuals files"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (bucket_id = 'equipment-manuals' AND public.is_approved());

DROP POLICY IF EXISTS "Authenticated users can view publications files" ON storage.objects;
CREATE POLICY "Approved users can view publications files"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (bucket_id = 'publications' AND public.is_approved());

DROP POLICY IF EXISTS "auth users view site photos" ON storage.objects;
CREATE POLICY "Approved users can view site photos"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (bucket_id = 'site-photos' AND public.is_approved());

-- ----------------------------------------------------------------------------
-- Verify: no policy should remain that grants access unconditionally.
-- Expect zero rows.
-- ----------------------------------------------------------------------------

-- SELECT schemaname, tablename, policyname, cmd, roles, qual
-- FROM pg_policies
-- WHERE schemaname IN ('public', 'storage')
--   AND (qual = 'true' OR with_check = 'true')
-- ORDER BY tablename, policyname;
