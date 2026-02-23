-- ===========================================
-- Khách hàng ưu tiên & cấu hình phân loại giảm giá
-- ===========================================

CREATE TABLE IF NOT EXISTS customer_segment_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  segment_key VARCHAR(50) NOT NULL UNIQUE,
  segment_label VARCHAR(100) NOT NULL,
  min_delivered_orders INTEGER NOT NULL DEFAULT 1 CHECK (min_delivered_orders >= 0),
  min_total_spent DECIMAL(12, 2) NOT NULL DEFAULT 0 CHECK (min_total_spent >= 0),
  discount_percent DECIMAL(5, 2) NOT NULL DEFAULT 0 CHECK (discount_percent >= 0 AND discount_percent <= 100),
  is_priority BOOLEAN NOT NULL DEFAULT true,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE customer_segment_settings
  ADD COLUMN IF NOT EXISTS discount_percent DECIMAL(5, 2) NOT NULL DEFAULT 0;

ALTER TABLE customer_segment_settings
  ADD COLUMN IF NOT EXISTS is_priority BOOLEAN NOT NULL DEFAULT true;

ALTER TABLE customer_segment_settings
  ADD COLUMN IF NOT EXISTS sort_order INTEGER NOT NULL DEFAULT 0;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'customer_segment_settings'
      AND column_name = 'discount_code'
  ) THEN
    UPDATE customer_segment_settings
    SET discount_percent = COALESCE(
      NULLIF(regexp_replace(discount_code, '[^0-9.]', '', 'g'), '')::DECIMAL,
      discount_percent,
      0
    )
    WHERE COALESCE(discount_percent, 0) = 0
      AND discount_code IS NOT NULL
      AND LENGTH(TRIM(discount_code)) > 0;
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS priority_customers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_phone VARCHAR(20) NOT NULL UNIQUE,
  customer_name VARCHAR(255) NOT NULL,
  customer_segment VARCHAR(50) NOT NULL,
  discount_percent DECIMAL(5, 2) NOT NULL DEFAULT 0 CHECK (discount_percent >= 0 AND discount_percent <= 100),
  total_orders_snapshot INTEGER NOT NULL DEFAULT 0 CHECK (total_orders_snapshot >= 0),
  delivered_orders_snapshot INTEGER NOT NULL DEFAULT 0 CHECK (delivered_orders_snapshot >= 0),
  total_spent_snapshot DECIMAL(12, 2) NOT NULL DEFAULT 0 CHECK (total_spent_snapshot >= 0),
  source VARCHAR(20) NOT NULL DEFAULT 'manual',
  notes TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  last_order_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  CONSTRAINT priority_customers_phone_valid CHECK (LENGTH(TRIM(customer_phone)) >= 8)
);

ALTER TABLE priority_customers
  ADD COLUMN IF NOT EXISTS discount_percent DECIMAL(5, 2) NOT NULL DEFAULT 0;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'priority_customers'
      AND column_name = 'discount_code'
  ) THEN
    UPDATE priority_customers
    SET discount_percent = COALESCE(
      NULLIF(regexp_replace(discount_code, '[^0-9.]', '', 'g'), '')::DECIMAL,
      discount_percent,
      0
    )
    WHERE COALESCE(discount_percent, 0) = 0
      AND discount_code IS NOT NULL
      AND LENGTH(TRIM(discount_code)) > 0;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_priority_customers_phone ON priority_customers(customer_phone);
CREATE INDEX IF NOT EXISTS idx_priority_customers_segment ON priority_customers(customer_segment);
CREATE INDEX IF NOT EXISTS idx_priority_customers_active ON priority_customers(is_active);

CREATE OR REPLACE FUNCTION update_priority_customer_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_priority_customers_updated_at ON priority_customers;
CREATE TRIGGER trigger_priority_customers_updated_at
  BEFORE UPDATE ON priority_customers
  FOR EACH ROW
  EXECUTE FUNCTION update_priority_customer_updated_at();

DROP TRIGGER IF EXISTS trigger_customer_segment_settings_updated_at ON customer_segment_settings;
CREATE TRIGGER trigger_customer_segment_settings_updated_at
  BEFORE UPDATE ON customer_segment_settings
  FOR EACH ROW
  EXECUTE FUNCTION update_priority_customer_updated_at();

ALTER TABLE customer_segment_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE priority_customers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admin full access customer_segment_settings" ON customer_segment_settings;
CREATE POLICY "Admin full access customer_segment_settings"
  ON customer_segment_settings FOR ALL
  USING (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Public read customer_segment_settings" ON customer_segment_settings;
CREATE POLICY "Public read customer_segment_settings"
  ON customer_segment_settings FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "Admin full access priority_customers" ON priority_customers;
CREATE POLICY "Admin full access priority_customers"
  ON priority_customers FOR ALL
  USING (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Public read active priority_customers" ON priority_customers;
CREATE POLICY "Public read active priority_customers"
  ON priority_customers FOR SELECT
  USING (is_active = true);

INSERT INTO customer_segment_settings (
  segment_key,
  segment_label,
  min_delivered_orders,
  min_total_spent,
  discount_percent,
  is_priority,
  sort_order
)
VALUES
  ('new', 'Khách mới', 1, 0, 0, false, 1),
  ('regular', 'Khách quen', 2, 0, 5, true, 2),
  ('loyal', 'Khách thân thiết', 3, 0, 10, true, 3)
ON CONFLICT (segment_key) DO NOTHING;

GRANT SELECT ON customer_segment_settings TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON customer_segment_settings TO authenticated;

GRANT SELECT ON priority_customers TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON priority_customers TO authenticated;
