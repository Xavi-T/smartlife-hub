BEGIN;

WITH march_period AS (
  SELECT
    make_date(EXTRACT(YEAR FROM CURRENT_DATE)::int, 3, 1)::timestamptz AS start_at,
    (
      make_date(EXTRACT(YEAR FROM CURRENT_DATE)::int, 3, 1)
      + INTERVAL '1 month - 1 second'
    )::timestamptz AS end_at
)
UPDATE products AS p
SET
  stock_quantity = 100,
  discount_percent = 30,
  discount_start_at = march_period.start_at,
  discount_end_at = march_period.end_at
FROM march_period;

COMMIT;
