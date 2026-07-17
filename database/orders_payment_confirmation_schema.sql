-- ===========================================
-- Orders payment confirmation columns
-- ===========================================

ALTER TABLE orders
ADD COLUMN IF NOT EXISTS checkout_method VARCHAR(20) NOT NULL DEFAULT 'cod'
  CHECK (checkout_method IN ('cod', 'bank_transfer'));

ALTER TABLE orders
ADD COLUMN IF NOT EXISTS payment_method VARCHAR(20) NOT NULL DEFAULT 'cod'
  CHECK (payment_method IN ('cod', 'bank_transfer', 'cash'));

-- Nếu production đã có constraint cũ chỉ cho phép cod/bank_transfer,
-- chạy block này để mở rộng thêm hình thức tiền mặt.
DO $$
DECLARE
  constraint_name TEXT;
BEGIN
  SELECT conname INTO constraint_name
  FROM pg_constraint
  WHERE conrelid = 'orders'::regclass
    AND contype = 'c'
    AND pg_get_constraintdef(oid) LIKE '%payment_method%'
    AND pg_get_constraintdef(oid) LIKE '%bank_transfer%';

  IF constraint_name IS NOT NULL THEN
    EXECUTE format('ALTER TABLE orders DROP CONSTRAINT %I', constraint_name);
  END IF;

  ALTER TABLE orders
  ADD CONSTRAINT orders_payment_method_check
  CHECK (payment_method IN ('cod', 'bank_transfer', 'cash'));
END $$;

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
