-- ============================================================================
-- ROLLBACK for 2026-09-07_tighten_rls.sql
--
-- Restores the exact policies that existed before the migration, reconstructed
-- from a pg_policies dump taken on 2026-09-07.
--
-- NOTE: running this re-opens the holes the migration closed, including the
-- profiles UPDATE policy that allows any logged-in user to make themselves an
-- admin. Use it only to get the app working again if the migration breaks
-- something unexpectedly, and then fix forward rather than leaving it here.
-- ============================================================================

-- Drop the new policies -------------------------------------------------------

DROP POLICY IF EXISTS "Read own profile or admin reads all" ON profiles;
DROP POLICY IF EXISTS "Create own profile as pending" ON profiles;
DROP POLICY IF EXISTS "Admins update profiles" ON profiles;
DROP POLICY IF EXISTS "Approved users can view inventory" ON inventory;
DROP POLICY IF EXISTS "Approved users can view logs" ON inventory_logs;
DROP POLICY IF EXISTS "Approved users can view bookings" ON inventory_bookings;
DROP POLICY IF EXISTS "Approved users can view manuals" ON manuals;
DROP POLICY IF EXISTS "Approved users can view manual_equipment" ON manual_equipment;
DROP POLICY IF EXISTS "Approved users can view publications" ON publications;
DROP POLICY IF EXISTS "Approved users can view categories" ON publication_categories;
DROP POLICY IF EXISTS "Approved users can view shared_links" ON shared_links;
DROP POLICY IF EXISTS "Approved users can view sites" ON sites;
DROP POLICY IF EXISTS "Approved users can view site_logs" ON site_logs;
DROP POLICY IF EXISTS "Approved users can view manuals files" ON storage.objects;
DROP POLICY IF EXISTS "Approved users can view publications files" ON storage.objects;
DROP POLICY IF EXISTS "Approved users can view site photos" ON storage.objects;

-- Restore the originals -------------------------------------------------------

CREATE POLICY "profiles_basic_select_policy"
  ON profiles FOR SELECT TO authenticated USING (true);
CREATE POLICY "profiles_basic_insert_policy"
  ON profiles FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "profiles_basic_update_policy"
  ON profiles FOR UPDATE TO authenticated USING (true);

CREATE POLICY "Enable access for approved users only"
  ON inventory FOR ALL TO public
  USING (EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid() AND profiles.role = ANY (ARRAY['admin'::text, 'user'::text])
  ));

CREATE POLICY "Allow users to view logs"
  ON inventory_logs FOR SELECT TO public USING (true);

CREATE POLICY "View bookings"
  ON inventory_bookings FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can view manuals"
  ON manuals FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can view manual_equipment"
  ON manual_equipment FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can view publications"
  ON publications FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can view categories"
  ON publication_categories FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can view shared_links"
  ON shared_links FOR SELECT TO authenticated USING (true);

CREATE POLICY "auth users view sites"
  ON sites FOR SELECT TO authenticated USING (true);

CREATE POLICY "authenticated_read_site_logs"
  ON site_logs FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can view manuals files"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'equipment-manuals'::text);

CREATE POLICY "Authenticated users can view publications files"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'publications'::text);

CREATE POLICY "auth users view site photos"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'site-photos'::text);

-- Helper functions are left in place; they are harmless if unused.
-- To remove them as well:
-- DROP FUNCTION IF EXISTS public.is_approved();
-- DROP FUNCTION IF EXISTS public.is_admin();
