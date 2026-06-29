-- ============================================================
-- Online / counter order workflow and customer-visible history
-- ============================================================
-- Online: pending -> confirmed -> shipping -> completed
-- Counter: completed immediately
-- Any active/completed order can be cancelled; stock is restored once.

-- Recreate the enum instead of ALTER TYPE ... ADD VALUE. Supabase SQL Editor
-- runs the whole script in one transaction, where a newly added enum value
-- cannot be used until commit.
DROP VIEW IF EXISTS product_sales_summary;
DROP VIEW IF EXISTS order_summary;

DROP TRIGGER IF EXISTS trigger_create_initial_order_status_history ON orders;
DROP FUNCTION IF EXISTS create_initial_order_status_history();
DROP FUNCTION IF EXISTS transition_order_status(UUID, TEXT);
DROP FUNCTION IF EXISTS transition_order_status(UUID, TEXT, TEXT, TEXT);

ALTER TABLE orders ALTER COLUMN status DROP DEFAULT;

DROP TYPE IF EXISTS order_status_next;
CREATE TYPE order_status_next AS ENUM (
  'pending',
  'confirmed',
  'shipping',
  'completed',
  'cancelled'
);

ALTER TABLE orders
ALTER COLUMN status TYPE order_status_next
USING (
  CASE status::TEXT
    WHEN 'processing' THEN 'shipping'
    WHEN 'delivered' THEN 'completed'
    WHEN 'pending' THEN 'pending'
    WHEN 'confirmed' THEN 'confirmed'
    WHEN 'shipping' THEN 'shipping'
    WHEN 'completed' THEN 'completed'
    WHEN 'cancelled' THEN 'cancelled'
    ELSE 'pending'
  END
)::order_status_next;

DO $$
BEGIN
  IF to_regclass('public.order_status_history') IS NOT NULL THEN
    ALTER TABLE order_status_history
    ALTER COLUMN status TYPE order_status_next
    USING (
      CASE status::TEXT
        WHEN 'processing' THEN 'shipping'
        WHEN 'delivered' THEN 'completed'
        WHEN 'pending' THEN 'pending'
        WHEN 'confirmed' THEN 'confirmed'
        WHEN 'shipping' THEN 'shipping'
        WHEN 'completed' THEN 'completed'
        WHEN 'cancelled' THEN 'cancelled'
        ELSE 'pending'
      END
    )::order_status_next;
  END IF;
END;
$$;

DROP TYPE order_status;
ALTER TYPE order_status_next RENAME TO order_status;

ALTER TABLE orders
ALTER COLUMN status SET DEFAULT 'pending'::order_status;

ALTER TABLE orders
ADD COLUMN IF NOT EXISTS order_type VARCHAR(20) NOT NULL DEFAULT 'online';

ALTER TABLE orders
DROP CONSTRAINT IF EXISTS orders_order_type_check;

ALTER TABLE orders
ADD CONSTRAINT orders_order_type_check
CHECK (order_type IN ('online', 'counter'));

UPDATE orders
SET order_type = 'counter'
WHERE customer_address = 'Mua tại quầy'
   OR notes ILIKE '%Bán tại quầy%';

CREATE TABLE IF NOT EXISTS order_status_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  status order_status NOT NULL,
  note TEXT,
  created_by TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_order_status_history_order
ON order_status_history(order_id, created_at);

ALTER TABLE order_status_history ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated read order status history"
ON order_status_history;
CREATE POLICY "Authenticated read order status history"
ON order_status_history FOR SELECT
USING (auth.role() = 'authenticated');

INSERT INTO order_status_history (
  order_id,
  status,
  note,
  created_by,
  created_at
)
SELECT
  order_row.id,
  order_row.status,
  CASE order_row.status
    WHEN 'pending' THEN 'Đơn hàng đã được tiếp nhận và đang chờ xác nhận.'
    WHEN 'confirmed' THEN 'Đơn hàng đã được cửa hàng xác nhận.'
    WHEN 'shipping' THEN 'Đơn hàng đang được vận chuyển.'
    WHEN 'completed' THEN 'Đơn hàng đã hoàn thành.'
    WHEN 'cancelled' THEN 'Đơn hàng đã bị hủy.'
  END,
  'system-migration',
  order_row.created_at
FROM orders AS order_row
WHERE NOT EXISTS (
  SELECT 1
  FROM order_status_history AS history
  WHERE history.order_id = order_row.id
);

CREATE OR REPLACE FUNCTION create_initial_order_status_history()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO order_status_history (
    order_id,
    status,
    note,
    created_by
  )
  VALUES (
    NEW.id,
    NEW.status,
    CASE NEW.status
      WHEN 'pending' THEN 'Đơn hàng đã được tiếp nhận và đang chờ xác nhận.'
      WHEN 'completed' THEN 'Đơn mua tại quầy đã hoàn thành.'
      ELSE 'Đơn hàng đã được tạo.'
    END,
    'system'
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_create_initial_order_status_history ON orders;
CREATE TRIGGER trigger_create_initial_order_status_history
AFTER INSERT ON orders
FOR EACH ROW
EXECUTE FUNCTION create_initial_order_status_history();

DROP FUNCTION IF EXISTS transition_order_status(UUID, TEXT);

CREATE OR REPLACE FUNCTION transition_order_status(
  p_order_id UUID,
  p_new_status TEXT,
  p_note TEXT DEFAULT NULL,
  p_changed_by TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_current_status order_status;
  v_new_status order_status;
  v_order_type VARCHAR(20);
  v_updated_order orders%ROWTYPE;
  v_stock_restored BOOLEAN := false;
  v_note TEXT;
BEGIN
  BEGIN
    v_new_status := p_new_status::order_status;
  EXCEPTION
    WHEN invalid_text_representation THEN
      RAISE EXCEPTION 'Trạng thái đơn hàng không hợp lệ';
  END;

  SELECT status, order_type
  INTO v_current_status, v_order_type
  FROM orders
  WHERE id = p_order_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Không tìm thấy đơn hàng';
  END IF;

  IF v_current_status = v_new_status THEN
    RAISE EXCEPTION 'Đơn hàng đã ở trạng thái này';
  END IF;

  IF v_order_type = 'counter' THEN
    IF NOT (
      v_current_status = 'completed' AND v_new_status = 'cancelled'
    ) THEN
      RAISE EXCEPTION 'Đơn tại quầy chỉ có thể chuyển từ hoàn thành sang đã hủy';
    END IF;
  ELSIF NOT (
    (v_current_status = 'pending' AND v_new_status IN ('confirmed', 'cancelled'))
    OR
    (v_current_status = 'confirmed' AND v_new_status IN ('shipping', 'cancelled'))
    OR
    (v_current_status = 'shipping' AND v_new_status IN ('completed', 'cancelled'))
    OR
    (v_current_status = 'completed' AND v_new_status = 'cancelled')
  ) THEN
    RAISE EXCEPTION
      'Không thể chuyển trạng thái từ % sang %',
      v_current_status,
      v_new_status;
  END IF;

  IF v_new_status = 'cancelled' THEN
    UPDATE products AS product
    SET
      stock_quantity = product.stock_quantity + reserved.quantity,
      updated_at = NOW()
    FROM (
      SELECT product_id, SUM(quantity)::INTEGER AS quantity
      FROM order_items
      WHERE order_id = p_order_id
      GROUP BY product_id
    ) AS reserved
    WHERE product.id = reserved.product_id;

    v_stock_restored := true;
  END IF;

  UPDATE orders
  SET
    status = v_new_status,
    updated_at = NOW()
  WHERE id = p_order_id
  RETURNING * INTO v_updated_order;

  v_note := NULLIF(BTRIM(COALESCE(p_note, '')), '');
  IF v_note IS NULL THEN
    v_note := CASE v_new_status
      WHEN 'confirmed' THEN 'Đơn hàng đã được cửa hàng xác nhận.'
      WHEN 'shipping' THEN 'Đơn hàng đang được vận chuyển.'
      WHEN 'completed' THEN 'Đơn hàng đã hoàn thành.'
      WHEN 'cancelled' THEN 'Đơn hàng đã bị hủy.'
      ELSE 'Trạng thái đơn hàng đã được cập nhật.'
    END;
  END IF;

  INSERT INTO order_status_history (
    order_id,
    status,
    note,
    created_by
  )
  VALUES (
    p_order_id,
    v_new_status,
    v_note,
    NULLIF(BTRIM(COALESCE(p_changed_by, '')), '')
  );

  RETURN TO_JSONB(v_updated_order) || JSONB_BUILD_OBJECT(
    'previous_status', v_current_status,
    'stock_restored', v_stock_restored
  );
END;
$$;

REVOKE ALL ON FUNCTION transition_order_status(UUID, TEXT, TEXT, TEXT)
FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION transition_order_status(UUID, TEXT, TEXT, TEXT)
TO service_role;

REVOKE ALL ON FUNCTION increment_product_stock(UUID, INTEGER)
FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION increment_product_stock(UUID, INTEGER)
TO service_role;

REVOKE ALL ON FUNCTION decrement_product_stock(UUID, INTEGER)
FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION decrement_product_stock(UUID, INTEGER)
TO service_role;

DROP VIEW IF EXISTS product_sales_summary;
CREATE VIEW product_sales_summary
WITH (security_invoker = true) AS
SELECT
  product.id,
  product.name,
  product.category,
  product.price,
  product.cost_price,
  COUNT(item.id) AS total_orders,
  COALESCE(SUM(item.quantity), 0) AS total_quantity_sold,
  COALESCE(SUM(item.subtotal), 0) AS total_revenue,
  COALESCE(SUM(item.quantity * product.cost_price), 0) AS total_cost,
  COALESCE(
    SUM(item.subtotal) - SUM(item.quantity * product.cost_price),
    0
  ) AS total_profit
FROM products AS product
LEFT JOIN order_items AS item ON product.id = item.product_id
  AND EXISTS (
    SELECT 1
    FROM orders AS completed_order
    WHERE completed_order.id = item.order_id
      AND completed_order.status = 'completed'
  )
GROUP BY
  product.id,
  product.name,
  product.category,
  product.price,
  product.cost_price;

DROP VIEW IF EXISTS order_summary;
CREATE VIEW order_summary
WITH (security_invoker = true) AS
SELECT
  DATE(order_row.created_at) AS order_date,
  COUNT(DISTINCT order_row.id) AS total_orders,
  COUNT(
    DISTINCT CASE
      WHEN order_row.status = 'completed' THEN order_row.id
    END
  ) AS delivered_orders,
  COUNT(
    DISTINCT CASE
      WHEN order_row.status = 'cancelled' THEN order_row.id
    END
  ) AS cancelled_orders,
  COALESCE(
    SUM(
      CASE
        WHEN order_row.status = 'completed' THEN order_row.total_amount
        ELSE 0
      END
    ),
    0
  ) AS total_revenue
FROM orders AS order_row
GROUP BY DATE(order_row.created_at)
ORDER BY order_date DESC;
