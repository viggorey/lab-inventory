-- ============================================
-- SUPABASE SETUP: Manuals & Publications
-- Run this in the Supabase SQL Editor
-- ============================================

-- 1. Publication Categories table
CREATE TABLE IF NOT EXISTS publication_categories (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id)
);

-- 2. Manuals table
CREATE TABLE IF NOT EXISTS manuals (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  equipment_id UUID REFERENCES inventory(id) ON DELETE SET NULL,
  description TEXT,
  version TEXT,
  pdf_path TEXT NOT NULL,
  pdf_filename TEXT NOT NULL,
  pdf_size_bytes BIGINT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id),
  updated_at TIMESTAMPTZ
);

-- 3. Publications table
CREATE TABLE IF NOT EXISTS publications (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  author TEXT NOT NULL,
  year INTEGER NOT NULL,
  category_id UUID REFERENCES publication_categories(id) ON DELETE SET NULL,
  doi TEXT,
  external_link TEXT,
  pdf_path TEXT,
  pdf_filename TEXT,
  pdf_size_bytes BIGINT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id),
  updated_at TIMESTAMPTZ
);

-- ============================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================

-- Enable RLS on all new tables
ALTER TABLE publication_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE manuals ENABLE ROW LEVEL SECURITY;
ALTER TABLE publications ENABLE ROW LEVEL SECURITY;

-- Publication Categories policies
CREATE POLICY "Authenticated users can view categories"
  ON publication_categories FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admins can insert categories"
  ON publication_categories FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "Admins can update categories"
  ON publication_categories FOR UPDATE
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "Admins can delete categories"
  ON publication_categories FOR DELETE
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- Manuals policies
CREATE POLICY "Authenticated users can view manuals"
  ON manuals FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admins can insert manuals"
  ON manuals FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "Admins can update manuals"
  ON manuals FOR UPDATE
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "Admins can delete manuals"
  ON manuals FOR DELETE
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- Publications policies
CREATE POLICY "Authenticated users can view publications"
  ON publications FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admins can insert publications"
  ON publications FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "Admins can update publications"
  ON publications FOR UPDATE
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "Admins can delete publications"
  ON publications FOR DELETE
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- ============================================
-- STORAGE BUCKETS
-- ============================================

-- Create storage buckets
INSERT INTO storage.buckets (id, name, public)
VALUES ('equipment-manuals', 'equipment-manuals', false)
ON CONFLICT (id) DO NOTHING;

INSERT INTO storage.buckets (id, name, public)
VALUES ('publications', 'publications', false)
ON CONFLICT (id) DO NOTHING;

-- Storage policies for equipment-manuals bucket
CREATE POLICY "Authenticated users can view manuals files"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (bucket_id = 'equipment-manuals');

CREATE POLICY "Admins can upload manuals files"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'equipment-manuals'
    AND EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "Admins can update manuals files"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'equipment-manuals'
    AND EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "Admins can delete manuals files"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'equipment-manuals'
    AND EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- Storage policies for publications bucket
CREATE POLICY "Authenticated users can view publications files"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (bucket_id = 'publications');

CREATE POLICY "Admins can upload publications files"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'publications'
    AND EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "Admins can update publications files"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'publications'
    AND EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "Admins can delete publications files"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'publications'
    AND EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );
