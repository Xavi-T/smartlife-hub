-- ===========================================
-- Bảng Product Variants (Loại sản phẩm)
-- ===========================================

CREATE TABLE IF NOT EXISTS product_variants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  variant_name TEXT NOT NULL,
  cost_price DECIMAL(12, 2) NOT NULL DEFAULT 0 CHECK (cost_price >= 0),
  price DECIMAL(12, 2) NOT NULL CHECK (price >= 0),
  image_url TEXT,
  sort_order INTEGER NOT NULL DEFAULT 1,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

ALTER TABLE product_variants
  ADD COLUMN IF NOT EXISTS cost_price DECIMAL(12, 2) NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_product_variants_product_id
  ON product_variants(product_id);

CREATE INDEX IF NOT EXISTS idx_product_variants_sort_order
  ON product_variants(product_id, sort_order);

ALTER TABLE product_variants ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'product_variants'
      AND policyname = 'Allow public read access to product_variants'
  ) THEN
    CREATE POLICY "Allow public read access to product_variants"
      ON product_variants FOR SELECT USING (true);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'product_variants'
      AND policyname = 'Allow authenticated write access to product_variants'
  ) THEN
    CREATE POLICY "Allow authenticated write access to product_variants"
      ON product_variants FOR ALL
      USING (auth.uid() IS NOT NULL)
      WITH CHECK (auth.uid() IS NOT NULL);
  END IF;
END $$;

CREATE OR REPLACE FUNCTION set_product_variants_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_product_variants_updated_at ON product_variants;
CREATE TRIGGER trigger_product_variants_updated_at
  BEFORE UPDATE ON product_variants
  FOR EACH ROW
  EXECUTE FUNCTION set_product_variants_updated_at();

GRANT SELECT ON product_variants TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON product_variants TO authenticated;
