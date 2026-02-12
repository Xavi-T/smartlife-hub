-- ===========================================
-- Function: Tạo đơn hàng với Transaction
-- ===========================================

CREATE OR REPLACE FUNCTION create_order_transaction(
  p_customer_name VARCHAR,
  p_customer_phone VARCHAR,
  p_customer_address TEXT,
  p_notes TEXT,
  p_items JSONB
)
RETURNS TABLE (
  order_id UUID,
  total_amount DECIMAL,
  message TEXT,
  success BOOLEAN
) 
LANGUAGE plpgsql
AS $$
DECLARE
  v_order_id UUID;
  v_total_amount DECIMAL := 0;
  v_item JSONB;
  v_product RECORD;
  v_subtotal DECIMAL;
BEGIN
  -- Bắt đầu transaction (implicit trong function)
  
  -- BƯỚC 1: Kiểm tra tồn kho cho tất cả sản phẩm
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    -- Lấy thông tin sản phẩm
    SELECT id, name, price, stock_quantity, is_active
    INTO v_product
    FROM products
    WHERE id = (v_item->>'product_id')::UUID
    FOR UPDATE; -- Lock row để tránh race condition
    
    -- Kiểm tra sản phẩm tồn tại
    IF NOT FOUND THEN
      RETURN QUERY SELECT 
        NULL::UUID,
        0::DECIMAL,
        'Sản phẩm không tồn tại: ' || (v_item->>'product_id'),
        false;
      RETURN;
    END IF;
    
    -- Kiểm tra sản phẩm còn hoạt động
    IF NOT v_product.is_active THEN
      RETURN QUERY SELECT 
        NULL::UUID,
        0::DECIMAL,
        'Sản phẩm đã ngừng bán: ' || v_product.name,
        false;
      RETURN;
    END IF;
    
    -- Kiểm tra tồn kho
    IF v_product.stock_quantity < (v_item->>'quantity')::INTEGER THEN
      RETURN QUERY SELECT 
        NULL::UUID,
        0::DECIMAL,
        'Không đủ hàng trong kho cho sản phẩm: ' || v_product.name || 
        ' (Còn: ' || v_product.stock_quantity || ', Yêu cầu: ' || (v_item->>'quantity') || ')',
        false;
      RETURN;
    END IF;
    
    -- Tính tổng tiền tạm
    v_subtotal := v_product.price * (v_item->>'quantity')::INTEGER;
    v_total_amount := v_total_amount + v_subtotal;
  END LOOP;
  
  -- BƯỚC 2: Tạo đơn hàng
  INSERT INTO orders (
    customer_name,
    customer_phone,
    customer_address,
    total_amount,
    status,
    notes
  ) VALUES (
    p_customer_name,
    p_customer_phone,
    p_customer_address,
    v_total_amount,
    'pending',
    p_notes
  )
  RETURNING id INTO v_order_id;
  
  -- BƯỚC 3: Tạo order_items và cập nhật tồn kho
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    -- Lấy giá hiện tại của sản phẩm
    SELECT price INTO v_product.price
    FROM products
    WHERE id = (v_item->>'product_id')::UUID;
    
    -- Tính subtotal
    v_subtotal := v_product.price * (v_item->>'quantity')::INTEGER;
    
    -- Thêm vào order_items
    INSERT INTO order_items (
      order_id,
      product_id,
      quantity,
      unit_price,
      subtotal
    ) VALUES (
      v_order_id,
      (v_item->>'product_id')::UUID,
      (v_item->>'quantity')::INTEGER,
      v_product.price,
      v_subtotal
    );
    
    -- Cập nhật (trừ) tồn kho
    UPDATE products
    SET stock_quantity = stock_quantity - (v_item->>'quantity')::INTEGER
    WHERE id = (v_item->>'product_id')::UUID;
  END LOOP;
  
  -- Trả về kết quả thành công
  RETURN QUERY SELECT 
    v_order_id,
    v_total_amount,
    'Đặt hàng thành công!'::TEXT,
    true;
    
EXCEPTION
  WHEN OTHERS THEN
    -- Rollback tự động khi có lỗi
    RETURN QUERY SELECT 
      NULL::UUID,
      0::DECIMAL,
      'Lỗi khi tạo đơn hàng: ' || SQLERRM,
      false;
END;
$$;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION create_order_transaction TO anon, authenticated;

-- Comment
COMMENT ON FUNCTION create_order_transaction IS 
'Tạo đơn hàng với transaction an toàn. Kiểm tra tồn kho, tạo order, order_items và cập nhật stock trong một transaction.';
