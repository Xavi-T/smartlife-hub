-- ============================================================
-- Read-only stock consistency report
-- ============================================================
-- This query does not update data. It compares current stock with:
-- total recorded inbound - quantities reserved by non-cancelled orders.
--
-- Review rows where difference <> 0 before making any manual correction.

WITH inbound AS (
  SELECT
    product_id,
    COALESCE(SUM(quantity_added), 0)::INTEGER AS total_inbound
  FROM stock_inbound
  GROUP BY product_id
),
reserved AS (
  SELECT
    item.product_id,
    COALESCE(SUM(item.quantity), 0)::INTEGER AS total_reserved
  FROM order_items AS item
  INNER JOIN orders AS order_row ON order_row.id = item.order_id
  WHERE order_row.status <> 'cancelled'
  GROUP BY item.product_id
)
SELECT
  product.id,
  product.name,
  product.stock_quantity AS current_stock,
  COALESCE(inbound.total_inbound, 0) AS recorded_inbound,
  COALESCE(reserved.total_reserved, 0) AS reserved_by_active_orders,
  COALESCE(inbound.total_inbound, 0) -
    COALESCE(reserved.total_reserved, 0) AS expected_stock,
  product.stock_quantity -
    (
      COALESCE(inbound.total_inbound, 0) -
      COALESCE(reserved.total_reserved, 0)
    ) AS difference
FROM products AS product
LEFT JOIN inbound ON inbound.product_id = product.id
LEFT JOIN reserved ON reserved.product_id = product.id
WHERE product.stock_quantity <>
  COALESCE(inbound.total_inbound, 0) -
  COALESCE(reserved.total_reserved, 0)
ORDER BY ABS(
  product.stock_quantity -
  (
    COALESCE(inbound.total_inbound, 0) -
    COALESCE(reserved.total_reserved, 0)
  )
) DESC,
product.name;
