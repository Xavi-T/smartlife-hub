-- ===========================================
-- Bảng Lịch sử Nhập hàng
-- ===========================================

CREATE TABLE IF NOT EXISTS stock_inbound (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  quantity_added INTEGER NOT NULL CHECK (quantity_added > 0),
  cost_price_at_time DECIMAL(10, 2) NOT NULL CHECK (cost_price_at_time >= 0),
  supplier VARCHAR(255),
  notes TEXT,
  created_by VARCHAR(100) DEFAULT 'Admin',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_stock_inbound_product_id ON stock_inbound(product_id);
CREATE INDEX IF NOT EXISTS idx_stock_inbound_created_at ON stock_inbound(created_at DESC);

-- Enable RLS
ALTER TABLE stock_inbound ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Allow read access to stock_inbound" ON stock_inbound
  FOR SELECT USING (true);

CREATE POLICY "Allow insert to stock_inbound" ON stock_inbound
  FOR INSERT WITH CHECK (true);

-- ===========================================
-- Function: Tính Giá Vốn Bình Quân Gia Quyền
-- ===========================================
-- Công thức: (Số lượng cũ × Giá cũ + Số lượng mới × Giá mới) / (Số lượng cũ + Số lượng mới)

CREATE OR REPLACE FUNCTION calculate_weighted_average_cost(
  p_product_id UUID,
  p_new_quantity INTEGER,
  p_new_cost DECIMAL
)
RETURNS DECIMAL AS $$
DECLARE
  v_current_quantity INTEGER;
  v_current_cost DECIMAL;
  v_weighted_avg_cost DECIMAL;
BEGIN
  -- Lấy số lượng và giá vốn hiện tại
  SELECT stock_quantity, cost_price 
  INTO v_current_quantity, v_current_cost
  FROM products
  WHERE id = p_product_id;

  -- Nếu không có hàng trong kho, giá vốn mới = giá nhập
  IF v_current_quantity IS NULL OR v_current_quantity = 0 THEN
    RETURN p_new_cost;
  END IF;

  -- Tính giá vốn bình quân gia quyền
  v_weighted_avg_cost := (
    (v_current_quantity * v_current_cost) + (p_new_quantity * p_new_cost)
  ) / (v_current_quantity + p_new_quantity);

  RETURN ROUND(v_weighted_avg_cost, 2);
END;
$$ LANGUAGE plpgsql;

-- Grant permissions
GRANT SELECT, INSERT ON stock_inbound TO anon, authenticated;
GRANT EXECUTE ON FUNCTION calculate_weighted_average_cost TO anon, authenticated;

-- ===========================================
-- Function: Xử lý Nhập hàng (Stock Inbound Transaction)
-- ===========================================

CREATE OR REPLACE FUNCTION process_stock_inbound(
  p_product_id UUID,
  p_quantity_added INTEGER,
  p_cost_price_at_time DECIMAL,
  p_supplier VARCHAR,
  p_notes TEXT DEFAULT NULL
)
RETURNS JSON AS $$
DECLARE
  v_new_avg_cost DECIMAL;
  v_new_stock_quantity INTEGER;
  v_inbound_id UUID;
  v_result JSON;
BEGIN
  -- Tính giá vốn bình quân gia quyền mới
  v_new_avg_cost := calculate_weighted_average_cost(
    p_product_id,
    p_quantity_added,
    p_cost_price_at_time
  );

  -- Cập nhật stock_quantity và cost_price trong products
  UPDATE products
  SET 
    stock_quantity = stock_quantity + p_quantity_added,
    cost_price = v_new_avg_cost,
    updated_at = NOW()
  WHERE id = p_product_id
  RETURNING stock_quantity INTO v_new_stock_quantity;

  -- Ghi vào bảng stock_inbound
  INSERT INTO stock_inbound (
    product_id,
    quantity_added,
    cost_price_at_time,
    supplier,
    notes
  ) VALUES (
    p_product_id,
    p_quantity_added,
    p_cost_price_at_time,
    p_supplier,
    p_notes
  )
  RETURNING id INTO v_inbound_id;

  -- Trả về kết quả
  v_result := json_build_object(
    'success', true,
    'inbound_id', v_inbound_id,
    'new_weighted_avg_cost', v_new_avg_cost,
    'new_stock_quantity', v_new_stock_quantity
  );

  RETURN v_result;
END;
$$ LANGUAGE plpgsql;

GRANT EXECUTE ON FUNCTION process_stock_inbound TO anon, authenticated;
