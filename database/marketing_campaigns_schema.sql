-- ============================================================
-- Marketing campaigns / loyalty points / voucher rewards
-- ============================================================

CREATE TABLE IF NOT EXISTS marketing_campaigns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_name VARCHAR(255) NOT NULL,
  campaign_code VARCHAR(50) UNIQUE,
  campaign_type VARCHAR(50) NOT NULL,
  description TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  is_unlimited_time BOOLEAN NOT NULL DEFAULT false,
  start_at TIMESTAMP WITH TIME ZONE,
  end_at TIMESTAMP WITH TIME ZONE,
  priority INTEGER NOT NULL DEFAULT 100,
  config JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_by VARCHAR(255),
  updated_by VARCHAR(255),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  CONSTRAINT marketing_campaigns_type_check CHECK (
    campaign_type IN ('points_earn', 'points_redeem_voucher', 'gift')
  ),
  CONSTRAINT marketing_campaigns_time_window_check CHECK (
    is_unlimited_time = true
    OR (
      start_at IS NOT NULL
      AND end_at IS NOT NULL
      AND start_at <= end_at
    )
  )
);

CREATE INDEX IF NOT EXISTS idx_marketing_campaigns_active
ON marketing_campaigns(is_active, campaign_type);

CREATE INDEX IF NOT EXISTS idx_marketing_campaigns_time
ON marketing_campaigns(start_at, end_at);

CREATE TABLE IF NOT EXISTS customer_point_wallets (
  customer_phone VARCHAR(20) PRIMARY KEY,
  total_points INTEGER NOT NULL DEFAULT 0 CHECK (total_points >= 0),
  lifetime_earned_points INTEGER NOT NULL DEFAULT 0 CHECK (lifetime_earned_points >= 0),
  lifetime_redeemed_points INTEGER NOT NULL DEFAULT 0 CHECK (lifetime_redeemed_points >= 0),
  last_transaction_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS customer_point_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_phone VARCHAR(20) NOT NULL,
  campaign_id UUID REFERENCES marketing_campaigns(id) ON DELETE SET NULL,
  direction VARCHAR(20) NOT NULL CHECK (direction IN ('earn', 'redeem', 'adjust')),
  points INTEGER NOT NULL CHECK (points > 0),
  reference_type VARCHAR(50),
  reference_id VARCHAR(100),
  note TEXT,
  created_by VARCHAR(255),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_customer_point_transactions_customer
ON customer_point_transactions(customer_phone, created_at DESC);

CREATE TABLE IF NOT EXISTS customer_vouchers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_phone VARCHAR(20),
  campaign_id UUID REFERENCES marketing_campaigns(id) ON DELETE SET NULL,
  voucher_code VARCHAR(50) NOT NULL UNIQUE,
  voucher_type VARCHAR(20) NOT NULL CHECK (voucher_type IN ('percent', 'amount')),
  voucher_value DECIMAL(12, 2) NOT NULL CHECK (voucher_value > 0),
  max_discount_amount DECIMAL(12, 2) NOT NULL DEFAULT 0 CHECK (max_discount_amount >= 0),
  min_order_amount DECIMAL(12, 2) NOT NULL DEFAULT 0 CHECK (min_order_amount >= 0),
  status VARCHAR(20) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'used', 'expired', 'cancelled')),
  expires_at TIMESTAMP WITH TIME ZONE,
  used_at TIMESTAMP WITH TIME ZONE,
  used_order_id UUID REFERENCES orders(id) ON DELETE SET NULL,
  used_discount_amount DECIMAL(12, 2) NOT NULL DEFAULT 0,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_by VARCHAR(255),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_customer_vouchers_status
ON customer_vouchers(status, expires_at);

CREATE INDEX IF NOT EXISTS idx_customer_vouchers_customer
ON customer_vouchers(customer_phone, created_at DESC);

CREATE OR REPLACE FUNCTION update_marketing_module_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_marketing_campaigns_updated_at ON marketing_campaigns;
CREATE TRIGGER trigger_marketing_campaigns_updated_at
  BEFORE UPDATE ON marketing_campaigns
  FOR EACH ROW
  EXECUTE FUNCTION update_marketing_module_updated_at();

DROP TRIGGER IF EXISTS trigger_customer_point_wallets_updated_at ON customer_point_wallets;
CREATE TRIGGER trigger_customer_point_wallets_updated_at
  BEFORE UPDATE ON customer_point_wallets
  FOR EACH ROW
  EXECUTE FUNCTION update_marketing_module_updated_at();

ALTER TABLE marketing_campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE customer_point_wallets ENABLE ROW LEVEL SECURITY;
ALTER TABLE customer_point_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE customer_vouchers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admin full access marketing_campaigns" ON marketing_campaigns;
CREATE POLICY "Admin full access marketing_campaigns"
  ON marketing_campaigns FOR ALL
  USING (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Admin read customer_point_wallets" ON customer_point_wallets;
CREATE POLICY "Admin read customer_point_wallets"
  ON customer_point_wallets FOR SELECT
  USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Admin full access customer_point_wallets" ON customer_point_wallets;
CREATE POLICY "Admin full access customer_point_wallets"
  ON customer_point_wallets FOR ALL
  USING (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Admin full access customer_point_transactions" ON customer_point_transactions;
CREATE POLICY "Admin full access customer_point_transactions"
  ON customer_point_transactions FOR ALL
  USING (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Admin full access customer_vouchers" ON customer_vouchers;
CREATE POLICY "Admin full access customer_vouchers"
  ON customer_vouchers FOR ALL
  USING (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Public read active vouchers by code" ON customer_vouchers;
CREATE POLICY "Public read active vouchers by code"
  ON customer_vouchers FOR SELECT
  USING (status = 'active');

GRANT SELECT, INSERT, UPDATE, DELETE ON marketing_campaigns TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON customer_point_wallets TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON customer_point_transactions TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON customer_vouchers TO authenticated;
GRANT SELECT ON customer_vouchers TO anon;
