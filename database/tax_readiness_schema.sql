-- ============================================================
-- Tax readiness foundation
-- - Annual revenue threshold settings
-- - Manual cash/bank income and expense records (future S2c/S2e)
-- - Product tax profiles (future S2a/S2b)
-- - Structured manual inventory adjustments (future S2d)
-- ============================================================
-- Run once in Supabase SQL Editor before deploying the related UI.

CREATE TABLE IF NOT EXISTS tax_compliance_settings (
  id SMALLINT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  annual_revenue_threshold NUMERIC(16, 2) NOT NULL DEFAULT 1000000000
    CHECK (annual_revenue_threshold > 0),
  warning_level_1 SMALLINT NOT NULL DEFAULT 80
    CHECK (warning_level_1 BETWEEN 1 AND 100),
  warning_level_2 SMALLINT NOT NULL DEFAULT 90
    CHECK (warning_level_2 BETWEEN 1 AND 100),
  warning_level_3 SMALLINT NOT NULL DEFAULT 100
    CHECK (warning_level_3 BETWEEN 1 AND 100),
  current_book_code VARCHAR(20) NOT NULL DEFAULT 'S1a-HKD',
  notes TEXT,
  updated_by TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  CONSTRAINT tax_warning_levels_ordered CHECK (
    warning_level_1 < warning_level_2
    AND warning_level_2 < warning_level_3
  )
);

INSERT INTO tax_compliance_settings (id)
VALUES (1)
ON CONFLICT (id) DO NOTHING;

CREATE TABLE IF NOT EXISTS financial_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  transaction_type VARCHAR(20) NOT NULL
    CHECK (transaction_type IN ('income', 'expense')),
  payment_channel VARCHAR(20) NOT NULL
    CHECK (payment_channel IN ('cash', 'bank')),
  occurred_at DATE NOT NULL,
  document_number VARCHAR(120),
  category VARCHAR(160) NOT NULL,
  description TEXT NOT NULL,
  amount NUMERIC(16, 2) NOT NULL CHECK (amount > 0),
  counterparty VARCHAR(255),
  order_id UUID REFERENCES orders(id) ON DELETE SET NULL,
  stock_inbound_id UUID REFERENCES stock_inbound(id) ON DELETE SET NULL,
  affects_tax_revenue BOOLEAN NOT NULL DEFAULT false,
  attachment_urls TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  notes TEXT,
  created_by TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  CONSTRAINT financial_description_not_empty
    CHECK (LENGTH(BTRIM(description)) > 0),
  CONSTRAINT financial_category_not_empty
    CHECK (LENGTH(BTRIM(category)) > 0)
);

CREATE INDEX IF NOT EXISTS idx_financial_transactions_occurred_at
ON financial_transactions(occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_financial_transactions_type_channel
ON financial_transactions(transaction_type, payment_channel);
CREATE INDEX IF NOT EXISTS idx_financial_transactions_order
ON financial_transactions(order_id)
WHERE order_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS product_tax_profiles (
  product_id UUID PRIMARY KEY REFERENCES products(id) ON DELETE CASCADE,
  tax_group_name VARCHAR(160),
  business_activity VARCHAR(160),
  vat_rate_percent NUMERIC(7, 4)
    CHECK (
      vat_rate_percent IS NULL
      OR vat_rate_percent BETWEEN 0 AND 100
    ),
  pit_rate_percent NUMERIC(7, 4)
    CHECK (
      pit_rate_percent IS NULL
      OR pit_rate_percent BETWEEN 0 AND 100
    ),
  notes TEXT,
  updated_by TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

INSERT INTO product_tax_profiles (product_id)
SELECT id
FROM products
ON CONFLICT (product_id) DO NOTHING;

CREATE TABLE IF NOT EXISTS inventory_adjustments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
  quantity_delta INTEGER NOT NULL CHECK (quantity_delta <> 0),
  reason TEXT NOT NULL CHECK (LENGTH(BTRIM(reason)) > 0),
  occurred_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  created_by TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_inventory_adjustments_product_date
ON inventory_adjustments(product_id, occurred_at DESC);

CREATE OR REPLACE FUNCTION update_tax_readiness_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_tax_compliance_settings_updated_at
ON tax_compliance_settings;
CREATE TRIGGER trigger_tax_compliance_settings_updated_at
BEFORE UPDATE ON tax_compliance_settings
FOR EACH ROW
EXECUTE FUNCTION update_tax_readiness_updated_at();

DROP TRIGGER IF EXISTS trigger_financial_transactions_updated_at
ON financial_transactions;
CREATE TRIGGER trigger_financial_transactions_updated_at
BEFORE UPDATE ON financial_transactions
FOR EACH ROW
EXECUTE FUNCTION update_tax_readiness_updated_at();

DROP TRIGGER IF EXISTS trigger_product_tax_profiles_updated_at
ON product_tax_profiles;
CREATE TRIGGER trigger_product_tax_profiles_updated_at
BEFORE UPDATE ON product_tax_profiles
FOR EACH ROW
EXECUTE FUNCTION update_tax_readiness_updated_at();

CREATE OR REPLACE FUNCTION create_default_product_tax_profile()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO product_tax_profiles (product_id)
  VALUES (NEW.id)
  ON CONFLICT (product_id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_create_default_product_tax_profile
ON products;
CREATE TRIGGER trigger_create_default_product_tax_profile
AFTER INSERT ON products
FOR EACH ROW
EXECUTE FUNCTION create_default_product_tax_profile();

CREATE OR REPLACE FUNCTION adjust_product_stock_with_history(
  p_product_id UUID,
  p_quantity_delta INTEGER,
  p_reason TEXT,
  p_changed_by TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_product products%ROWTYPE;
  v_adjustment inventory_adjustments%ROWTYPE;
BEGIN
  IF p_quantity_delta IS NULL OR p_quantity_delta = 0 THEN
    RAISE EXCEPTION 'Số lượng điều chỉnh phải khác 0';
  END IF;

  IF BTRIM(COALESCE(p_reason, '')) = '' THEN
    RAISE EXCEPTION 'Lý do điều chỉnh là bắt buộc';
  END IF;

  SELECT *
  INTO v_product
  FROM products
  WHERE id = p_product_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Không tìm thấy sản phẩm';
  END IF;

  IF v_product.stock_quantity + p_quantity_delta < 0 THEN
    RAISE EXCEPTION 'Tồn kho không đủ để điều chỉnh';
  END IF;

  UPDATE products
  SET
    stock_quantity = stock_quantity + p_quantity_delta,
    updated_at = NOW()
  WHERE id = p_product_id
  RETURNING * INTO v_product;

  INSERT INTO inventory_adjustments (
    product_id,
    quantity_delta,
    reason,
    created_by
  )
  VALUES (
    p_product_id,
    p_quantity_delta,
    BTRIM(p_reason),
    NULLIF(BTRIM(COALESCE(p_changed_by, '')), '')
  )
  RETURNING * INTO v_adjustment;

  RETURN JSONB_BUILD_OBJECT(
    'product', TO_JSONB(v_product),
    'adjustment', TO_JSONB(v_adjustment)
  );
END;
$$;

ALTER TABLE tax_compliance_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE financial_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_tax_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_adjustments ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE tax_compliance_settings
FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE financial_transactions
FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE product_tax_profiles
FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE inventory_adjustments
FROM PUBLIC, anon, authenticated;

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE tax_compliance_settings
TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE financial_transactions
TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE product_tax_profiles
TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE inventory_adjustments
TO service_role;

REVOKE ALL ON FUNCTION create_default_product_tax_profile()
FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION adjust_product_stock_with_history(UUID, INTEGER, TEXT, TEXT)
FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION adjust_product_stock_with_history(UUID, INTEGER, TEXT, TEXT)
TO service_role;
