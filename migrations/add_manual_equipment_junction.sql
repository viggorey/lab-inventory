-- ============================================
-- MIGRATION: Many-to-Many Manual-Equipment Linking
-- Run this in the Supabase SQL Editor
-- ============================================

-- 1. Create the junction table
CREATE TABLE IF NOT EXISTS manual_equipment (
  manual_id UUID NOT NULL REFERENCES manuals(id) ON DELETE CASCADE,
  equipment_id UUID NOT NULL REFERENCES inventory(id) ON DELETE CASCADE,
  UNIQUE (manual_id, equipment_id)
);

-- 2. Migrate existing equipment_id data from manuals into the junction table
INSERT INTO manual_equipment (manual_id, equipment_id)
SELECT id, equipment_id
FROM manuals
WHERE equipment_id IS NOT NULL
ON CONFLICT DO NOTHING;

-- 3. Drop the equipment_id column from manuals
ALTER TABLE manuals DROP COLUMN IF EXISTS equipment_id;

-- 4. Enable RLS
ALTER TABLE manual_equipment ENABLE ROW LEVEL SECURITY;

-- 5. Add RLS policies (same pattern as manuals table)
CREATE POLICY "Authenticated users can view manual_equipment"
  ON manual_equipment FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admins can insert manual_equipment"
  ON manual_equipment FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "Admins can update manual_equipment"
  ON manual_equipment FOR UPDATE
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "Admins can delete manual_equipment"
  ON manual_equipment FOR DELETE
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );
