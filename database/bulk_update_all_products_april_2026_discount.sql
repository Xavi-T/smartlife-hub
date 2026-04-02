BEGIN;

UPDATE products
SET
  discount_percent = 20,
  discount_start_at = NOW(),
  discount_end_at = TIMESTAMPTZ '2026-04-30 23:59:59+07';

COMMIT;
