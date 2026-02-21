-- ===========================================
-- Add discount percent for products
-- ===========================================

ALTER TABLE products
ADD COLUMN IF NOT EXISTS discount_percent NUMERIC(5,2) NOT NULL DEFAULT 0;

ALTER TABLE products
DROP CONSTRAINT IF EXISTS products_discount_percent_range;

ALTER TABLE products
ADD CONSTRAINT products_discount_percent_range
CHECK (discount_percent >= 0 AND discount_percent <= 100);

CREATE INDEX IF NOT EXISTS idx_products_discount_percent ON products(discount_percent);
