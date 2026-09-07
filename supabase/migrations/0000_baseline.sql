-- ============================================================================
-- BASELINE SCHEMA — Lab Inventory (project lmijffjvwpfmvccbgiyr)
--
-- Captured from the live database on 2026-09-07, after
-- migrations/2026-09-07_tighten_rls.sql was applied. Column types, defaults,
-- nullability, constraints and indexes are transcribed from the database
-- catalog, not inferred from application code.
--
-- This file replaces supabase-setup.sql, which defined only 5 of the 12 tables
-- and could not rebuild a working app (it omitted `profiles`, so nobody could
-- authenticate).
--
-- Run order matters: tables reference auth.users, which Supabase provides.
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================================
-- TABLES
-- ============================================================================

-- ---------------------------------------------------------------- profiles --
-- Gates all access. A row is created on sign-up with role 'pending'; an admin
-- promotes it to 'user' or 'denied'.
CREATE TABLE IF NOT EXISTS public.profiles (
  id         uuid        NOT NULL,
  email      text        NOT NULL,
  role       text        NOT NULL DEFAULT 'pending'::text,
  created_at timestamptz DEFAULT now(),
  CONSTRAINT profiles_pkey PRIMARY KEY (id),
  CONSTRAINT profiles_email_key UNIQUE (email),
  CONSTRAINT fk_user FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE
);
-- NOTE: the live database also carries a second, redundant foreign key on the
-- same column (profiles_id_fkey -> auth.users(id), no ON DELETE clause).
-- It is not recreated here; fk_user already enforces the relationship and adds
-- the cascade. Drop it in the live database when convenient:
--   ALTER TABLE public.profiles DROP CONSTRAINT profiles_id_fkey;

-- --------------------------------------------------------------- inventory --
CREATE TABLE IF NOT EXISTS public.inventory (
  id              uuid        NOT NULL DEFAULT gen_random_uuid(),
  name            text        NOT NULL,
  quantity        text        NOT NULL,
  category        text        NOT NULL,
  location        text        NOT NULL,
  source          text,
  created_by      uuid,
  created_at      timestamptz DEFAULT now(),
  updated_by      uuid,
  updated_at      timestamptz,
  unit            text,
  comment         text,
  lab             text        NOT NULL DEFAULT 'main'::text,
  broken          boolean     NOT NULL DEFAULT false,
  broken_at       timestamptz,
  broken_by_email text,
  broken_comment  text,
  CONSTRAINT inventory_pkey PRIMARY KEY (id),
  CONSTRAINT inventory_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id),
  CONSTRAINT inventory_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES auth.users(id),
  -- quantity is text but must be a whole number; the app's "ranges" are not
  -- actually permitted by the database.
  CONSTRAINT valid_quantity CHECK ((quantity ~ '^[0-9]+$'::text))
);

-- ------------------------------------------------------ inventory_bookings --
CREATE TABLE IF NOT EXISTS public.inventory_bookings (
  id             uuid        NOT NULL DEFAULT uuid_generate_v4(),
  item_id        uuid,
  user_id        uuid,
  user_email     text,
  quantity       integer,
  start_datetime timestamptz,
  end_datetime   timestamptz,
  booked_at      timestamptz DEFAULT now(),
  status         text,
  purpose        text,
  CONSTRAINT inventory_bookings_pkey PRIMARY KEY (id),
  CONSTRAINT inventory_bookings_item_id_fkey FOREIGN KEY (item_id)
    REFERENCES public.inventory(id) ON DELETE CASCADE,
  CONSTRAINT inventory_bookings_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id),
  CONSTRAINT inventory_bookings_status_check
    CHECK ((status = ANY (ARRAY['active'::text, 'completed'::text, 'cancelled'::text])))
);

-- ---------------------------------------------------------- inventory_logs --
-- The audit trail shown by "View History" and the User Activity Dashboard.
CREATE TABLE IF NOT EXISTS public.inventory_logs (
  id          uuid        NOT NULL DEFAULT uuid_generate_v4(),
  item_id     uuid,
  user_id     uuid,
  action_type text,
  field_name  text,
  old_value   text,
  new_value   text,
  "timestamp" timestamptz DEFAULT now(),
  user_email  text,
  CONSTRAINT inventory_logs_pkey PRIMARY KEY (id),
  CONSTRAINT inventory_logs_item_id_fkey FOREIGN KEY (item_id)
    REFERENCES public.inventory(id) ON DELETE CASCADE,
  CONSTRAINT inventory_logs_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id),
  CONSTRAINT inventory_logs_action_type_check
    CHECK ((action_type = ANY (ARRAY['create'::text, 'edit'::text, 'delete'::text])))
);

-- ------------------------------------------------------- inventory_changes --
-- LEGACY: present in the database but referenced nowhere in the application.
-- Kept so the baseline reproduces the live schema exactly.
CREATE TABLE IF NOT EXISTS public.inventory_changes (
  id           uuid        NOT NULL DEFAULT gen_random_uuid(),
  inventory_id uuid        NOT NULL,
  changed_by   uuid        NOT NULL,
  changed_at   timestamptz DEFAULT now(),
  change_type  text        NOT NULL,
  old_values   jsonb,
  new_values   jsonb,
  CONSTRAINT inventory_changes_pkey PRIMARY KEY (id),
  CONSTRAINT inventory_changes_inventory_id_fkey FOREIGN KEY (inventory_id)
    REFERENCES public.inventory(id),
  CONSTRAINT inventory_changes_changed_by_fkey FOREIGN KEY (changed_by) REFERENCES auth.users(id),
  CONSTRAINT valid_change_type
    CHECK ((change_type = ANY (ARRAY['create'::text, 'update'::text, 'delete'::text])))
);

-- ----------------------------------------------------------------- manuals --
-- pdf_* columns also hold ZIP archives since the manuals archive change; the
-- names are historical.
CREATE TABLE IF NOT EXISTS public.manuals (
  id             uuid        NOT NULL DEFAULT gen_random_uuid(),
  title          text        NOT NULL,
  description    text,
  version        text,
  pdf_path       text        NOT NULL,
  pdf_filename   text        NOT NULL,
  pdf_size_bytes bigint      NOT NULL,
  created_at     timestamptz DEFAULT now(),
  created_by     uuid,
  updated_at     timestamptz,
  CONSTRAINT manuals_pkey PRIMARY KEY (id),
  CONSTRAINT manuals_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id)
);
-- (A dropped column occupies ordinal 3 in the live table: the original
--  single equipment_id, replaced by the manual_equipment junction.)

-- -------------------------------------------------------- manual_equipment --
-- Note: no primary key, only a unique pair.
CREATE TABLE IF NOT EXISTS public.manual_equipment (
  manual_id    uuid NOT NULL,
  equipment_id uuid NOT NULL,
  CONSTRAINT manual_equipment_manual_id_equipment_id_key UNIQUE (manual_id, equipment_id),
  CONSTRAINT manual_equipment_manual_id_fkey FOREIGN KEY (manual_id)
    REFERENCES public.manuals(id) ON DELETE CASCADE,
  CONSTRAINT manual_equipment_equipment_id_fkey FOREIGN KEY (equipment_id)
    REFERENCES public.inventory(id) ON DELETE CASCADE
);

-- -------------------------------------------------- publication_categories --
CREATE TABLE IF NOT EXISTS public.publication_categories (
  id          uuid        NOT NULL DEFAULT gen_random_uuid(),
  name        text        NOT NULL,
  description text,
  created_at  timestamptz DEFAULT now(),
  created_by  uuid,
  CONSTRAINT publication_categories_pkey PRIMARY KEY (id),
  CONSTRAINT publication_categories_created_by_fkey FOREIGN KEY (created_by)
    REFERENCES auth.users(id)
);

-- ------------------------------------------------------------ publications --
CREATE TABLE IF NOT EXISTS public.publications (
  id             uuid        NOT NULL DEFAULT gen_random_uuid(),
  title          text        NOT NULL,
  author         text        NOT NULL,
  year           integer     NOT NULL,
  category_id    uuid,
  doi            text,
  external_link  text,
  pdf_path       text,
  pdf_filename   text,
  pdf_size_bytes bigint,
  notes          text,
  created_at     timestamptz DEFAULT now(),
  created_by     uuid,
  updated_at     timestamptz,
  CONSTRAINT publications_pkey PRIMARY KEY (id),
  CONSTRAINT publications_category_id_fkey FOREIGN KEY (category_id)
    REFERENCES public.publication_categories(id) ON DELETE SET NULL,
  CONSTRAINT publications_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id)
);

-- ------------------------------------------------------------ shared_links --
CREATE TABLE IF NOT EXISTS public.shared_links (
  id         uuid        NOT NULL DEFAULT gen_random_uuid(),
  title      text        NOT NULL,
  url        text        NOT NULL,
  comment    text,
  created_at timestamptz DEFAULT now(),
  created_by uuid,
  updated_at timestamptz,
  CONSTRAINT shared_links_pkey PRIMARY KEY (id),
  CONSTRAINT shared_links_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id)
);

-- ------------------------------------------------------------------- sites --
-- Brunei field sites shown on the map.
CREATE TABLE IF NOT EXISTS public.sites (
  id          uuid        NOT NULL DEFAULT gen_random_uuid(),
  name        text        NOT NULL,
  lat         double precision NOT NULL,
  lng         double precision NOT NULL,
  description text,
  photo       text,
  flora       text[]      DEFAULT '{}'::text[],
  fauna       text[]      DEFAULT '{}'::text[],
  created_at  timestamptz DEFAULT now(),
  created_by  uuid,
  CONSTRAINT sites_pkey PRIMARY KEY (id)
);

-- --------------------------------------------------------------- site_logs --
CREATE TABLE IF NOT EXISTS public.site_logs (
  id          uuid        NOT NULL DEFAULT gen_random_uuid(),
  site_id     uuid        NOT NULL,
  user_id     uuid,
  user_email  text        NOT NULL,
  action_type text        NOT NULL,
  field_name  text,
  old_value   text,
  new_value   text,
  "timestamp" timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT site_logs_pkey PRIMARY KEY (id),
  CONSTRAINT site_logs_site_id_fkey FOREIGN KEY (site_id)
    REFERENCES public.sites(id) ON DELETE CASCADE,
  CONSTRAINT site_logs_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id)
);

-- ============================================================================
-- FUNCTIONS
-- ============================================================================

-- Role checks used by the policies below. SECURITY DEFINER so they bypass RLS
-- when reading profiles: a policy ON profiles that SELECTs profiles recurses.
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin');
$$;

CREATE OR REPLACE FUNCTION public.is_approved()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'user')
  );
$$;

REVOKE EXECUTE ON FUNCTION public.is_admin() FROM anon;
REVOKE EXECUTE ON FUNCTION public.is_approved() FROM anon;
GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_approved() TO authenticated;

-- Creates a profile row when a user signs up. Intended to be attached to a
-- trigger on auth.users.
--
-- KNOWN ISSUE: it reads the email from raw_user_meta_data->>'email', which is
-- empty for password sign-ups (the address is in NEW.email). profiles.email is
-- NOT NULL, so the insert fails — silently, because the exception handler
-- swallows it. In practice the client creates the profile instead (useAuth).
-- Reproduced as-is; fix separately rather than in a baseline.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, role, created_at)
  VALUES (NEW.id, NEW.raw_user_meta_data->>'email', 'pending', CURRENT_TIMESTAMP);
  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    RAISE LOG 'Error in handle_new_user: %', SQLERRM;
    RETURN NEW;
END;
$$;

-- LEGACY / BROKEN: references public.email_logs, a table that does not exist.
-- Present in the live database; recreated only for fidelity. Safe to drop.
CREATE OR REPLACE FUNCTION public.log_email_attempt()
RETURNS trigger LANGUAGE plpgsql
AS $$
BEGIN
  INSERT INTO public.email_logs (attempt_time, recipient, success, error_message)
  VALUES (NOW(), COALESCE(NEW.email, 'unknown'), FALSE, 'Attempt to send email');
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RETURN NEW;
END;
$$;

-- ============================================================================
-- ROW LEVEL SECURITY
--
-- Reflects the state after migrations/2026-09-07_tighten_rls.sql.
-- Reading requires an approved role ('admin' or 'user'); writing requires
-- 'admin', except bookings which any approved user may manage.
-- ============================================================================

ALTER TABLE public.profiles               ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory              ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_bookings     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_logs         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_changes      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.manuals                ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.manual_equipment       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.publications           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.publication_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shared_links           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sites                  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.site_logs              ENABLE ROW LEVEL SECURITY;

-- profiles: a pending user must still read their own row, or the app cannot
-- discover their role and show the "awaiting approval" screen.
CREATE POLICY "Read own profile or admin reads all" ON public.profiles
  FOR SELECT TO authenticated USING (id = auth.uid() OR public.is_admin());
CREATE POLICY "Create own profile as pending" ON public.profiles
  FOR INSERT TO authenticated WITH CHECK (id = auth.uid() AND role = 'pending');
CREATE POLICY "Admins update profiles" ON public.profiles
  FOR UPDATE TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

-- inventory
CREATE POLICY "Approved users can view inventory" ON public.inventory
  FOR SELECT TO authenticated USING (public.is_approved());
CREATE POLICY "Only admins can insert inventory" ON public.inventory
  FOR INSERT TO public WITH CHECK (public.is_admin());
CREATE POLICY "Only admins can update inventory" ON public.inventory
  FOR UPDATE TO public USING (public.is_admin());
CREATE POLICY "Only admins can delete inventory" ON public.inventory
  FOR DELETE TO public USING (public.is_admin());

-- inventory_bookings: any approved user may book and manage bookings.
CREATE POLICY "Approved users can view bookings" ON public.inventory_bookings
  FOR SELECT TO authenticated USING (public.is_approved());
CREATE POLICY "Create bookings" ON public.inventory_bookings
  FOR INSERT TO public WITH CHECK (public.is_approved());
CREATE POLICY "Update bookings" ON public.inventory_bookings
  FOR UPDATE TO public USING (public.is_approved());
CREATE POLICY "Delete bookings" ON public.inventory_bookings
  FOR DELETE TO public USING (public.is_approved());

-- inventory_logs
CREATE POLICY "Approved users can view logs" ON public.inventory_logs
  FOR SELECT TO authenticated USING (public.is_approved());
CREATE POLICY "Only admins can insert logs" ON public.inventory_logs
  FOR INSERT TO public WITH CHECK (public.is_admin());

-- inventory_changes (legacy table, policies retained)
CREATE POLICY "Authenticated users can view changes" ON public.inventory_changes
  FOR SELECT TO public USING (public.is_approved());
CREATE POLICY "Only admins can record changes" ON public.inventory_changes
  FOR INSERT TO public WITH CHECK (public.is_admin());

-- manuals
CREATE POLICY "Approved users can view manuals" ON public.manuals
  FOR SELECT TO authenticated USING (public.is_approved());
CREATE POLICY "Admins can insert manuals" ON public.manuals
  FOR INSERT TO authenticated WITH CHECK (public.is_admin());
CREATE POLICY "Admins can update manuals" ON public.manuals
  FOR UPDATE TO authenticated USING (public.is_admin());
CREATE POLICY "Admins can delete manuals" ON public.manuals
  FOR DELETE TO authenticated USING (public.is_admin());

-- manual_equipment
CREATE POLICY "Approved users can view manual_equipment" ON public.manual_equipment
  FOR SELECT TO authenticated USING (public.is_approved());
CREATE POLICY "Admins can insert manual_equipment" ON public.manual_equipment
  FOR INSERT TO authenticated WITH CHECK (public.is_admin());
CREATE POLICY "Admins can update manual_equipment" ON public.manual_equipment
  FOR UPDATE TO authenticated USING (public.is_admin());
CREATE POLICY "Admins can delete manual_equipment" ON public.manual_equipment
  FOR DELETE TO authenticated USING (public.is_admin());

-- publications
CREATE POLICY "Approved users can view publications" ON public.publications
  FOR SELECT TO authenticated USING (public.is_approved());
CREATE POLICY "Admins can insert publications" ON public.publications
  FOR INSERT TO authenticated WITH CHECK (public.is_admin());
CREATE POLICY "Admins can update publications" ON public.publications
  FOR UPDATE TO authenticated USING (public.is_admin());
CREATE POLICY "Admins can delete publications" ON public.publications
  FOR DELETE TO authenticated USING (public.is_admin());

-- publication_categories
CREATE POLICY "Approved users can view categories" ON public.publication_categories
  FOR SELECT TO authenticated USING (public.is_approved());
CREATE POLICY "Admins can insert categories" ON public.publication_categories
  FOR INSERT TO authenticated WITH CHECK (public.is_admin());
CREATE POLICY "Admins can update categories" ON public.publication_categories
  FOR UPDATE TO authenticated USING (public.is_admin());
CREATE POLICY "Admins can delete categories" ON public.publication_categories
  FOR DELETE TO authenticated USING (public.is_admin());

-- shared_links
CREATE POLICY "Approved users can view shared_links" ON public.shared_links
  FOR SELECT TO authenticated USING (public.is_approved());
CREATE POLICY "Admins can insert shared_links" ON public.shared_links
  FOR INSERT TO authenticated WITH CHECK (public.is_admin());
CREATE POLICY "Admins can update shared_links" ON public.shared_links
  FOR UPDATE TO authenticated USING (public.is_admin());
CREATE POLICY "Admins can delete shared_links" ON public.shared_links
  FOR DELETE TO authenticated USING (public.is_admin());

-- sites
CREATE POLICY "Approved users can view sites" ON public.sites
  FOR SELECT TO authenticated USING (public.is_approved());
CREATE POLICY "admins insert sites" ON public.sites
  FOR INSERT TO authenticated WITH CHECK (public.is_admin());
CREATE POLICY "admins update sites" ON public.sites
  FOR UPDATE TO authenticated USING (public.is_admin());
CREATE POLICY "admins delete sites" ON public.sites
  FOR DELETE TO authenticated USING (public.is_admin());

-- site_logs
CREATE POLICY "Approved users can view site_logs" ON public.site_logs
  FOR SELECT TO authenticated USING (public.is_approved());
CREATE POLICY "admin_insert_site_logs" ON public.site_logs
  FOR INSERT TO authenticated WITH CHECK (public.is_admin());

-- ============================================================================
-- STORAGE
--
-- All three buckets are private; files are served through short-lived signed
-- URLs. No per-bucket size or MIME limits are set, so the project-wide 50 MB
-- upload cap applies (fixed on the free plan).
--
-- `site-photos` existed only in the dashboard before this file — it appeared in
-- no SQL anywhere in the repository.
-- ============================================================================

INSERT INTO storage.buckets (id, name, public)
VALUES ('equipment-manuals', 'equipment-manuals', false)
ON CONFLICT (id) DO NOTHING;

INSERT INTO storage.buckets (id, name, public)
VALUES ('publications', 'publications', false)
ON CONFLICT (id) DO NOTHING;

INSERT INTO storage.buckets (id, name, public)
VALUES ('site-photos', 'site-photos', false)
ON CONFLICT (id) DO NOTHING;

-- equipment-manuals
CREATE POLICY "Approved users can view manuals files" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'equipment-manuals' AND public.is_approved());
CREATE POLICY "Admins can upload manuals files" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'equipment-manuals' AND public.is_admin());
CREATE POLICY "Admins can update manuals files" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'equipment-manuals' AND public.is_admin());
CREATE POLICY "Admins can delete manuals files" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'equipment-manuals' AND public.is_admin());

-- publications
CREATE POLICY "Approved users can view publications files" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'publications' AND public.is_approved());
CREATE POLICY "Admins can upload publications files" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'publications' AND public.is_admin());
CREATE POLICY "Admins can update publications files" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'publications' AND public.is_admin());
CREATE POLICY "Admins can delete publications files" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'publications' AND public.is_admin());

-- site-photos (written and deleted server-side with the service-role key,
-- which bypasses these policies; they cover direct client access)
CREATE POLICY "Approved users can view site photos" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'site-photos' AND public.is_approved());
CREATE POLICY "admins upload site photos" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'site-photos' AND public.is_admin());
CREATE POLICY "admins delete site photos" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'site-photos' AND public.is_admin());

-- ============================================================================
-- NOT CAPTURED HERE
--
-- * Triggers on auth.users (the schema query covered `public` only). If
--   handle_new_user is attached to a trigger there, recreate it manually.
-- * The FK on sites.created_by, if one exists — that row was cut off by the
--   size limit of the captured output.
-- * auth/storage schema internals, which Supabase provisions.
-- ============================================================================
