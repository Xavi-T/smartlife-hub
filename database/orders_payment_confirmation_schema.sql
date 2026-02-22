-- ===========================================
-- Orders payment confirmation columns
-- ===========================================

ALTER TABLE orders
ADD COLUMN IF NOT EXISTS checkout_method VARCHAR(20) NOT NULL DEFAULT 'cod'
  CHECK (checkout_method IN ('cod', 'bank_transfer'));

ALTER TABLE orders
ADD COLUMN IF NOT EXISTS payment_method VARCHAR(20) NOT NULL DEFAULT 'cod'
  CHECK (payment_method IN ('cod', 'bank_transfer'));

ALTER TABLE orders
ADD COLUMN IF NOT EXISTS payment_confirmed BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE orders
ADD COLUMN IF NOT EXISTS payment_confirmed_at TIMESTAMP WITH TIME ZONE;

ALTER TABLE orders
ADD COLUMN IF NOT EXISTS payment_confirmed_by VARCHAR(255);

CREATE INDEX IF NOT EXISTS idx_orders_payment_method
  ON orders(payment_method);

CREATE INDEX IF NOT EXISTS idx_orders_payment_confirmed
  ON orders(payment_confirmed);
