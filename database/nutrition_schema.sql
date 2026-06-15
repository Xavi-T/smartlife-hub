-- ===========================================
-- SmartLife Hub - Nutrition Module
-- Bài viết dinh dưỡng, hồ sơ tư vấn và kết quả tính toán cơ bản
-- ===========================================

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ===========================================
-- Nutrition Categories
-- ===========================================
CREATE TABLE IF NOT EXISTS nutrition_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(160) NOT NULL,
  slug VARCHAR(180) NOT NULL UNIQUE,
  description TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  CONSTRAINT nutrition_categories_name_not_empty CHECK (LENGTH(TRIM(name)) > 0)
);

CREATE INDEX IF NOT EXISTS idx_nutrition_categories_slug
  ON nutrition_categories(slug);
CREATE INDEX IF NOT EXISTS idx_nutrition_categories_active
  ON nutrition_categories(is_active);

-- ===========================================
-- Nutrition Articles
-- ===========================================
CREATE TABLE IF NOT EXISTS nutrition_articles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title VARCHAR(255) NOT NULL,
  slug VARCHAR(280) NOT NULL UNIQUE,
  excerpt TEXT,
  content TEXT NOT NULL DEFAULT '',
  cover_image_url TEXT,
  category_id UUID REFERENCES nutrition_categories(id) ON DELETE SET NULL,
  author_name VARCHAR(160),
  status VARCHAR(20) NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'published', 'archived')),
  related_product_ids UUID[] NOT NULL DEFAULT '{}',
  published_at TIMESTAMP WITH TIME ZONE,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  CONSTRAINT nutrition_articles_title_not_empty CHECK (LENGTH(TRIM(title)) > 0)
);

CREATE INDEX IF NOT EXISTS idx_nutrition_articles_slug
  ON nutrition_articles(slug);
CREATE INDEX IF NOT EXISTS idx_nutrition_articles_status
  ON nutrition_articles(status);
CREATE INDEX IF NOT EXISTS idx_nutrition_articles_category
  ON nutrition_articles(category_id);
CREATE INDEX IF NOT EXISTS idx_nutrition_articles_published_at
  ON nutrition_articles(published_at DESC);

-- ===========================================
-- Nutrition Clients
-- ===========================================
CREATE TABLE IF NOT EXISTS nutrition_clients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name VARCHAR(255) NOT NULL,
  phone VARCHAR(30) NOT NULL,
  gender VARCHAR(20) NOT NULL DEFAULT 'female'
    CHECK (gender IN ('male', 'female', 'other')),
  birth_date DATE,
  height_cm DECIMAL(6, 2) CHECK (height_cm IS NULL OR height_cm > 0),
  weight_kg DECIMAL(6, 2) CHECK (weight_kg IS NULL OR weight_kg > 0),
  activity_level VARCHAR(30) NOT NULL DEFAULT 'light'
    CHECK (activity_level IN ('sedentary', 'light', 'moderate', 'active', 'very_active')),
  goal VARCHAR(30) NOT NULL DEFAULT 'maintain'
    CHECK (goal IN ('lose_weight', 'maintain', 'gain_weight', 'improve_health')),
  medical_notes TEXT,
  allergies TEXT,
  doctor_notes TEXT,
  status VARCHAR(20) NOT NULL DEFAULT 'active'
    CHECK (status IN ('new', 'active', 'paused', 'completed')),
  consent_given BOOLEAN NOT NULL DEFAULT false,
  consent_at TIMESTAMP WITH TIME ZONE,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  CONSTRAINT nutrition_clients_name_not_empty CHECK (LENGTH(TRIM(full_name)) > 0),
  CONSTRAINT nutrition_clients_phone_not_empty CHECK (LENGTH(TRIM(phone)) >= 8)
);

CREATE INDEX IF NOT EXISTS idx_nutrition_clients_phone
  ON nutrition_clients(phone);
CREATE INDEX IF NOT EXISTS idx_nutrition_clients_status
  ON nutrition_clients(status);
CREATE INDEX IF NOT EXISTS idx_nutrition_clients_created_at
  ON nutrition_clients(created_at DESC);

-- ===========================================
-- Nutrition Assessments
-- ===========================================
CREATE TABLE IF NOT EXISTS nutrition_assessments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES nutrition_clients(id) ON DELETE CASCADE,
  assessed_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  age_years INTEGER CHECK (age_years IS NULL OR age_years >= 0),
  gender VARCHAR(20) NOT NULL DEFAULT 'female',
  height_cm DECIMAL(6, 2) NOT NULL CHECK (height_cm > 0),
  weight_kg DECIMAL(6, 2) NOT NULL CHECK (weight_kg > 0),
  activity_level VARCHAR(30) NOT NULL DEFAULT 'light',
  goal VARCHAR(30) NOT NULL DEFAULT 'maintain',
  bmi DECIMAL(6, 2) NOT NULL,
  bmi_category VARCHAR(80) NOT NULL,
  bmr DECIMAL(8, 2) NOT NULL,
  tdee DECIMAL(8, 2) NOT NULL,
  target_calories DECIMAL(8, 2) NOT NULL,
  protein_g DECIMAL(8, 2) NOT NULL,
  fat_g DECIMAL(8, 2) NOT NULL,
  carb_g DECIMAL(8, 2) NOT NULL,
  doctor_notes TEXT,
  recommendation_text TEXT,
  related_product_ids UUID[] NOT NULL DEFAULT '{}',
  formula_version VARCHAR(40) NOT NULL DEFAULT 'mifflin-st-jeor-v1',
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_nutrition_assessments_client_id
  ON nutrition_assessments(client_id);
CREATE INDEX IF NOT EXISTS idx_nutrition_assessments_assessed_at
  ON nutrition_assessments(assessed_at DESC);

-- ===========================================
-- Clinical Nutrition Products
-- Sản phẩm chỉ dùng để tính khẩu phần lâm sàng, không liên quan bán hàng/kho
-- ===========================================
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

-- ===========================================
-- Updated_at triggers
-- ===========================================
CREATE OR REPLACE FUNCTION set_nutrition_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_nutrition_categories_updated_at ON nutrition_categories;
CREATE TRIGGER trigger_nutrition_categories_updated_at
  BEFORE UPDATE ON nutrition_categories
  FOR EACH ROW
  EXECUTE FUNCTION set_nutrition_updated_at();

DROP TRIGGER IF EXISTS trigger_nutrition_articles_updated_at ON nutrition_articles;
CREATE TRIGGER trigger_nutrition_articles_updated_at
  BEFORE UPDATE ON nutrition_articles
  FOR EACH ROW
  EXECUTE FUNCTION set_nutrition_updated_at();

DROP TRIGGER IF EXISTS trigger_nutrition_clients_updated_at ON nutrition_clients;
CREATE TRIGGER trigger_nutrition_clients_updated_at
  BEFORE UPDATE ON nutrition_clients
  FOR EACH ROW
  EXECUTE FUNCTION set_nutrition_updated_at();

DROP TRIGGER IF EXISTS trigger_clinical_nutrition_products_updated_at ON clinical_nutrition_products;
CREATE TRIGGER trigger_clinical_nutrition_products_updated_at
  BEFORE UPDATE ON clinical_nutrition_products
  FOR EACH ROW
  EXECUTE FUNCTION set_nutrition_updated_at();

-- ===========================================
-- RLS
-- ===========================================
ALTER TABLE nutrition_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE nutrition_articles ENABLE ROW LEVEL SECURITY;
ALTER TABLE nutrition_clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE nutrition_assessments ENABLE ROW LEVEL SECURITY;
ALTER TABLE clinical_nutrition_products ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public read active nutrition categories" ON nutrition_categories;
CREATE POLICY "Public read active nutrition categories"
  ON nutrition_categories FOR SELECT
  USING (is_active = true);

DROP POLICY IF EXISTS "Authenticated manage nutrition categories" ON nutrition_categories;
CREATE POLICY "Authenticated manage nutrition categories"
  ON nutrition_categories FOR ALL
  USING (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Public read published nutrition articles" ON nutrition_articles;
CREATE POLICY "Public read published nutrition articles"
  ON nutrition_articles FOR SELECT
  USING (status = 'published');

DROP POLICY IF EXISTS "Authenticated manage nutrition articles" ON nutrition_articles;
CREATE POLICY "Authenticated manage nutrition articles"
  ON nutrition_articles FOR ALL
  USING (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Authenticated manage nutrition clients" ON nutrition_clients;
CREATE POLICY "Authenticated manage nutrition clients"
  ON nutrition_clients FOR ALL
  USING (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Authenticated manage nutrition assessments" ON nutrition_assessments;
CREATE POLICY "Authenticated manage nutrition assessments"
  ON nutrition_assessments FOR ALL
  USING (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Authenticated manage clinical nutrition products" ON clinical_nutrition_products;
CREATE POLICY "Authenticated manage clinical nutrition products"
  ON clinical_nutrition_products FOR ALL
  USING (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');

GRANT SELECT ON nutrition_categories TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON nutrition_categories TO authenticated;

GRANT SELECT ON nutrition_articles TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON nutrition_articles TO authenticated;

GRANT SELECT, INSERT, UPDATE, DELETE ON nutrition_clients TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON nutrition_assessments TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON clinical_nutrition_products TO authenticated;

-- Seed danh mục cơ bản
INSERT INTO nutrition_categories (name, slug, description)
VALUES
  ('Giảm cân lành mạnh', 'giam-can-lanh-manh', 'Kiến thức giảm cân an toàn, bền vững'),
  ('Ăn lành mạnh', 'an-lanh-manh', 'Thói quen ăn uống cân bằng cho gia đình'),
  ('Mẹ và bé', 'me-va-be', 'Dinh dưỡng cho mẹ và trẻ nhỏ'),
  ('Bệnh lý chuyển hóa', 'benh-ly-chuyen-hoa', 'Chủ đề về tiểu đường, mỡ máu và sức khỏe chuyển hóa')
ON CONFLICT (slug) DO NOTHING;
