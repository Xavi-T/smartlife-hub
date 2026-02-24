-- ===========================================
-- Bảng Site Media Assets
-- Dùng cho logo, favicon, banner, media tái sử dụng toàn hệ thống
-- ===========================================

CREATE TABLE IF NOT EXISTS site_media_assets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  media_key TEXT UNIQUE,
  purpose TEXT NOT NULL DEFAULT 'site_logo',
  alt_text TEXT,
  file_name TEXT NOT NULL,
  mime_type TEXT NOT NULL,
  file_size BIGINT NOT NULL,
  image_url TEXT NOT NULL,
  storage_path TEXT NOT NULL,
  display_order INTEGER,
  width INTEGER,
  height INTEGER,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_site_media_assets_purpose ON site_media_assets(purpose);
CREATE INDEX IF NOT EXISTS idx_site_media_assets_display_order ON site_media_assets(display_order);
CREATE INDEX IF NOT EXISTS idx_site_media_assets_created_at ON site_media_assets(created_at DESC);

ALTER TABLE site_media_assets
  ADD COLUMN IF NOT EXISTS display_order INTEGER;

-- Trigger updated_at
CREATE OR REPLACE FUNCTION set_site_media_assets_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_site_media_assets_updated_at ON site_media_assets;
CREATE TRIGGER trigger_site_media_assets_updated_at
  BEFORE UPDATE ON site_media_assets
  FOR EACH ROW
  EXECUTE FUNCTION set_site_media_assets_updated_at();

ALTER TABLE site_media_assets ENABLE ROW LEVEL SECURITY;

-- Public read để frontend có thể lấy logo/banner/favicons
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'site_media_assets'
      AND policyname = 'Allow public read access to site_media_assets'
  ) THEN
    CREATE POLICY "Allow public read access to site_media_assets"
      ON site_media_assets
      FOR SELECT
      USING (true);
  END IF;
END $$;

-- Authenticated users có thể ghi dữ liệu (nếu cần chặt hơn có thể siết theo role sau)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'site_media_assets'
      AND policyname = 'Allow authenticated insert to site_media_assets'
  ) THEN
    CREATE POLICY "Allow authenticated insert to site_media_assets"
      ON site_media_assets
      FOR INSERT
      WITH CHECK (auth.uid() IS NOT NULL);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'site_media_assets'
      AND policyname = 'Allow authenticated update to site_media_assets'
  ) THEN
    CREATE POLICY "Allow authenticated update to site_media_assets"
      ON site_media_assets
      FOR UPDATE
      USING (auth.uid() IS NOT NULL);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'site_media_assets'
      AND policyname = 'Allow authenticated delete to site_media_assets'
  ) THEN
    CREATE POLICY "Allow authenticated delete to site_media_assets"
      ON site_media_assets
      FOR DELETE
      USING (auth.uid() IS NOT NULL);
  END IF;
END $$;

GRANT SELECT ON site_media_assets TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON site_media_assets TO authenticated;
