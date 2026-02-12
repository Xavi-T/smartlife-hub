-- ===========================================
-- Helper Functions cho Stock Management
-- ===========================================

-- Function: Cộng thêm stock (dùng cho hoàn trả khi hủy đơn)
CREATE OR REPLACE FUNCTION increment_product_stock(
  product_uuid UUID,
  quantity_to_add INTEGER
)
RETURNS VOID AS $$
BEGIN
  UPDATE products
  SET 
    stock_quantity = stock_quantity + quantity_to_add,
    updated_at = NOW()
  WHERE id = product_uuid;
END;
$$ LANGUAGE plpgsql;

-- Function: Trừ stock (dùng cho xác nhận đơn hàng)
CREATE OR REPLACE FUNCTION decrement_product_stock(
  product_uuid UUID,
  quantity_to_subtract INTEGER
)
RETURNS VOID AS $$
BEGIN
  UPDATE products
  SET 
    stock_quantity = stock_quantity - quantity_to_subtract,
    updated_at = NOW()
  WHERE id = product_uuid;
  
  -- Kiểm tra stock không được âm
  IF (SELECT stock_quantity FROM products WHERE id = product_uuid) < 0 THEN
    RAISE EXCEPTION 'Không đủ hàng trong kho';
  END IF;
END;
$$ LANGUAGE plpgsql;

-- Grant permissions
GRANT EXECUTE ON FUNCTION increment_product_stock TO anon, authenticated;
GRANT EXECUTE ON FUNCTION decrement_product_stock TO anon, authenticated;
