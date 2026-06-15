-- ===========================================
-- SmartLife Hub - Clinical Nutrition Products
-- Danh mục sản phẩm chỉ dùng để tính khẩu phần lâm sàng
-- ===========================================

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE IF NOT EXISTS clinical_nutrition_products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  unit VARCHAR(10) NOT NULL DEFAULT 'ml'
    CHECK (unit IN ('ml', 'g')),
  protein_per100 DECIMAL(10, 4) NOT NULL DEFAULT 0 CHECK (protein_per100 >= 0),
  lipid_per100 DECIMAL(10, 4) NOT NULL DEFAULT 0 CHECK (lipid_per100 >= 0),
  glucose_per100 DECIMAL(10, 4) NOT NULL DEFAULT 0 CHECK (glucose_per100 >= 0),
  energy_per100 DECIMAL(10, 4) NOT NULL DEFAULT 0 CHECK (energy_per100 >= 0),
  note TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  CONSTRAINT clinical_nutrition_products_name_not_empty CHECK (LENGTH(TRIM(name)) > 0)
);

CREATE INDEX IF NOT EXISTS idx_clinical_nutrition_products_active
  ON clinical_nutrition_products(is_active);
CREATE INDEX IF NOT EXISTS idx_clinical_nutrition_products_name
  ON clinical_nutrition_products(name);
CREATE INDEX IF NOT EXISTS idx_clinical_nutrition_products_sort
  ON clinical_nutrition_products(sort_order, name);

CREATE OR REPLACE FUNCTION set_nutrition_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_clinical_nutrition_products_updated_at ON clinical_nutrition_products;
CREATE TRIGGER trigger_clinical_nutrition_products_updated_at
  BEFORE UPDATE ON clinical_nutrition_products
  FOR EACH ROW
  EXECUTE FUNCTION set_nutrition_updated_at();

ALTER TABLE clinical_nutrition_products ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated manage clinical nutrition products" ON clinical_nutrition_products;
CREATE POLICY "Authenticated manage clinical nutrition products"
  ON clinical_nutrition_products FOR ALL
  USING (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');

GRANT SELECT, INSERT, UPDATE, DELETE ON clinical_nutrition_products TO authenticated;
