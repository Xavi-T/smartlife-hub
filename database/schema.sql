-- ===========================================
-- SmartLife Hub - Database Schema
-- Hệ thống bán hàng gia dụng với Next.js và Supabase
-- ===========================================

-- Tạo extension UUID nếu chưa có
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ===========================================
-- Bảng PRODUCTS - Quản lý sản phẩm
-- ===========================================
CREATE TABLE products (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(255) NOT NULL,
  description TEXT,
  price DECIMAL(12, 2) NOT NULL CHECK (price >= 0),
  cost_price DECIMAL(12, 2) NOT NULL CHECK (cost_price >= 0),
  stock_quantity INTEGER NOT NULL DEFAULT 0 CHECK (stock_quantity >= 0),
  image_url VARCHAR(500),
  category VARCHAR(100) NOT NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Constraints
  CONSTRAINT price_greater_than_cost CHECK (price >= cost_price),
  CONSTRAINT name_not_empty CHECK (LENGTH(TRIM(name)) > 0),
  CONSTRAINT category_not_empty CHECK (LENGTH(TRIM(category)) > 0)
);

-- Index cho tìm kiếm nhanh
CREATE INDEX idx_products_category ON products(category);
CREATE INDEX idx_products_active ON products(is_active) WHERE is_active = true;
CREATE INDEX idx_products_name ON products(name);

-- ===========================================
-- Bảng ORDERS - Quản lý đơn hàng
-- ===========================================
CREATE TYPE order_status AS ENUM ('pending', 'processing', 'delivered', 'cancelled');

CREATE TABLE orders (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  customer_name VARCHAR(255) NOT NULL,
  customer_phone VARCHAR(20) NOT NULL,
  customer_address TEXT NOT NULL,
  total_amount DECIMAL(12, 2) NOT NULL CHECK (total_amount >= 0),
  status order_status DEFAULT 'pending',
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Constraints
  CONSTRAINT customer_name_not_empty CHECK (LENGTH(TRIM(customer_name)) > 0),
  CONSTRAINT customer_phone_valid CHECK (customer_phone ~ '^[0-9+\-\s()]+$' AND LENGTH(TRIM(customer_phone)) >= 10),
  CONSTRAINT customer_address_not_empty CHECK (LENGTH(TRIM(customer_address)) > 0)
);

-- Index cho tìm kiếm và báo cáo
CREATE INDEX idx_orders_status ON orders(status);
CREATE INDEX idx_orders_created_at ON orders(created_at DESC);
CREATE INDEX idx_orders_customer_phone ON orders(customer_phone);

-- ===========================================
-- Bảng ORDER_ITEMS - Chi tiết đơn hàng
-- ===========================================
CREATE TABLE order_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  unit_price DECIMAL(12, 2) NOT NULL CHECK (unit_price >= 0),
  subtotal DECIMAL(12, 2) NOT NULL CHECK (subtotal >= 0),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Constraints
  CONSTRAINT subtotal_matches_calculation CHECK (subtotal = quantity * unit_price),
  CONSTRAINT unique_product_per_order UNIQUE(order_id, product_id)
);

-- Index cho hiệu suất
CREATE INDEX idx_order_items_order_id ON order_items(order_id);
CREATE INDEX idx_order_items_product_id ON order_items(product_id);

-- ===========================================
-- TRIGGERS - Tự động cập nhật updated_at
-- ===========================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_products_updated_at
  BEFORE UPDATE ON products
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_orders_updated_at
  BEFORE UPDATE ON orders
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ===========================================
-- FUNCTION - Tự động tính tổng tiền đơn hàng
-- ===========================================
CREATE OR REPLACE FUNCTION calculate_order_total(order_uuid UUID)
RETURNS DECIMAL AS $$
DECLARE
  total DECIMAL(12, 2);
BEGIN
  SELECT COALESCE(SUM(subtotal), 0) INTO total
  FROM order_items
  WHERE order_id = order_uuid;
  
  RETURN total;
END;
$$ LANGUAGE plpgsql;

-- ===========================================
-- TRIGGER - Cập nhật tồn kho khi tạo/xóa order_items
-- ===========================================
CREATE OR REPLACE FUNCTION update_stock_on_order_item()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    -- Giảm tồn kho khi thêm sản phẩm vào đơn
    UPDATE products
    SET stock_quantity = stock_quantity - NEW.quantity
    WHERE id = NEW.product_id;
    
    -- Kiểm tra tồn kho không được âm
    IF (SELECT stock_quantity FROM products WHERE id = NEW.product_id) < 0 THEN
      RAISE EXCEPTION 'Không đủ hàng trong kho cho sản phẩm này';
    END IF;
    
    -- Cập nhật tổng tiền đơn hàng
    UPDATE orders
    SET total_amount = calculate_order_total(NEW.order_id)
    WHERE id = NEW.order_id;
    
  ELSIF TG_OP = 'DELETE' THEN
    -- Hoàn lại tồn kho khi xóa sản phẩm khỏi đơn
    UPDATE products
    SET stock_quantity = stock_quantity + OLD.quantity
    WHERE id = OLD.product_id;
    
    -- Cập nhật tổng tiền đơn hàng
    UPDATE orders
    SET total_amount = calculate_order_total(OLD.order_id)
    WHERE id = OLD.order_id;
    
  ELSIF TG_OP = 'UPDATE' THEN
    -- Điều chỉnh tồn kho khi thay đổi số lượng
    UPDATE products
    SET stock_quantity = stock_quantity + OLD.quantity - NEW.quantity
    WHERE id = NEW.product_id;
    
    -- Kiểm tra tồn kho
    IF (SELECT stock_quantity FROM products WHERE id = NEW.product_id) < 0 THEN
      RAISE EXCEPTION 'Không đủ hàng trong kho cho sản phẩm này';
    END IF;
    
    -- Cập nhật tổng tiền đơn hàng
    UPDATE orders
    SET total_amount = calculate_order_total(NEW.order_id)
    WHERE id = NEW.order_id;
  END IF;
  
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_stock_on_order_item
  AFTER INSERT OR UPDATE OR DELETE ON order_items
  FOR EACH ROW
  EXECUTE FUNCTION update_stock_on_order_item();

-- ===========================================
-- ROW LEVEL SECURITY (RLS)
-- ===========================================

-- Bật RLS cho tất cả các bảng
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_items ENABLE ROW LEVEL SECURITY;

-- Policy cho PRODUCTS
-- Cho phép mọi người xem sản phẩm đang hoạt động
CREATE POLICY "Cho phép xem sản phẩm công khai"
  ON products FOR SELECT
  USING (is_active = true);

-- Chỉ admin mới được thêm/sửa/xóa sản phẩm (cần auth)
CREATE POLICY "Admin quản lý sản phẩm"
  ON products FOR ALL
  USING (auth.role() = 'authenticated');

-- Policy cho ORDERS
-- Cho phép tạo đơn hàng mới (public)
CREATE POLICY "Cho phép tạo đơn hàng mới"
  ON orders FOR INSERT
  WITH CHECK (true);

-- Chỉ admin xem/sửa đơn hàng
CREATE POLICY "Admin quản lý đơn hàng"
  ON orders FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "Admin cập nhật đơn hàng"
  ON orders FOR UPDATE
  USING (auth.role() = 'authenticated');

-- Policy cho ORDER_ITEMS
-- Cho phép thêm items khi tạo đơn
CREATE POLICY "Cho phép thêm items vào đơn hàng"
  ON order_items FOR INSERT
  WITH CHECK (true);

-- Chỉ admin xem chi tiết đơn
CREATE POLICY "Admin xem chi tiết đơn hàng"
  ON order_items FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "Admin cập nhật chi tiết đơn hàng"
  ON order_items FOR UPDATE
  USING (auth.role() = 'authenticated');

CREATE POLICY "Admin xóa chi tiết đơn hàng"
  ON order_items FOR DELETE
  USING (auth.role() = 'authenticated');

-- ===========================================
-- DỮ LIỆU MẪU (Optional - để test)
-- ===========================================

-- Thêm sản phẩm mẫu
-- Note: Thay thế image_url bằng URL từ Cloudinary của bạn
INSERT INTO products (name, description, price, cost_price, stock_quantity, category, image_url) VALUES

-- Đồ điện gia dụng
('Nồi cơm điện Panasonic 1.8L', 'Nồi cơm điện chống dính, công suất 700W, nấu cơm ngon mềm', 1200000, 900000, 50, 'Đồ điện gia dụng', 'https://images.unsplash.com/photo-1585659722983-3a675dabf23d?w=500'),
('Máy xay sinh tố Philips HR2115', 'Máy xay đa năng, công suất 600W, cối nhựa 1.5L', 1500000, 1100000, 40, 'Đồ điện gia dụng', 'https://images.unsplash.com/photo-1570616969692-54d6ba3d0397?w=500'),
('Bàn ủi hơi nước Philips GC1028', 'Bàn ủi hơi nước 2000W, mặt đế chống dính', 450000, 300000, 35, 'Đồ điện gia dụng', 'https://images.unsplash.com/photo-1574269909862-7e1d70bb8078?w=500'),
('Máy hút bụi cầm tay Electrolux', 'Máy hút bụi nhỏ gọn, lực hút mạnh, không dây', 890000, 650000, 25, 'Đồ điện gia dụng', 'https://images.unsplash.com/photo-1558317374-067fb5f30001?w=500'),
('Quạt điện đứng Senko L1650', 'Quạt 3 cánh, 5 tốc độ, điều khiển từ xa', 680000, 450000, 45, 'Đồ điện gia dụng', 'https://images.unsplash.com/photo-1580114812828-e787e03f846d?w=500'),
('Máy sấy tóc Panasonic EH-ND30', 'Máy sấy tóc 1200W, 2 chế độ nhiệt', 320000, 220000, 60, 'Đồ điện gia dụng', 'https://images.unsplash.com/photo-1522338242992-e1a54906a8da?w=500'),

-- Đồ dùng bếp
('Bộ nồi inox 5 món', 'Bộ nồi inox 304 cao cấp, đáy 3 lớp dẫn nhiệt tốt', 2500000, 1800000, 30, 'Đồ dùng bếp', 'https://images.unsplash.com/photo-1584990347449-7c901e1eb05f?w=500'),
('Chảo chống dính 28cm Lock&Lock', 'Chảo chống dính vân đá marble, phủ 5 lớp an toàn', 350000, 200000, 100, 'Đồ dùng bếp', 'https://images.unsplash.com/photo-1556908153-8a8a1748ff0f?w=500'),
('Bộ dao nhà bếp 6 món', 'Bộ dao inox sắc bén, có khay gỗ đựng sang trọng', 480000, 320000, 55, 'Đồ dùng bếp', 'https://images.unsplash.com/photo-1593618998160-e34014e67546?w=500'),
('Thớt gỗ tre tự nhiên 40cm', 'Thớt gỗ tre dày, kháng khuẩn tự nhiên, bền đẹp', 180000, 100000, 70, 'Đồ dùng bếp', 'https://images.unsplash.com/photo-1616428788657-80e912c2e831?w=500'),
('Bình đựng dầu ăn thủy tinh', 'Bình đựng dầu ăn 500ml, nắp chống tràn', 95000, 60000, 120, 'Đồ dùng bếp', 'https://images.unsplash.com/photo-1602143407151-7111542de6e8?w=500'),
('Hộp đựng thực phẩm Lock&Lock 5 món', 'Hộp nhựa PP an toàn, nắp kín 4 cạnh', 280000, 180000, 85, 'Đồ dùng bếp', 'https://images.unsplash.com/photo-1610557892470-55d9e80c0bce?w=500'),

-- Đồ gia dụng
('Bình giữ nhiệt inox 1L', 'Bình giữ nhiệt inox 304, giữ nóng/lạnh 12-24h', 250000, 150000, 80, 'Đồ gia dụng', 'https://images.unsplash.com/photo-1602143407151-7111542de6e8?w=500'),
('Giỏ để đồ đa năng 3 tầng', 'Giỏ inox 3 tầng, chứa rau củ, đồ dùng tiện lợi', 380000, 250000, 42, 'Đồ gia dụng', 'https://images.unsplash.com/photo-1594068889457-cf2a2a1a2c89?w=500'),
('Thùng rác inox đạp chân 12L', 'Thùng rác inox đạp chân, nắp đóng mở êm', 420000, 280000, 35, 'Đồ gia dụng', 'https://images.unsplash.com/photo-1624372648678-c04de5fd59f2?w=500'),
('Giá phơi quần áo 3 tầng', 'Giá phơi inox không gỉ, gấp gọn dễ di chuyển', 550000, 380000, 28, 'Đồ gia dụng', 'https://images.unsplash.com/photo-1582735689369-4fe89db7114c?w=500'),
('Bộ móc treo đồ 10 cái', 'Móc dán tường chịu lực 3kg, không cần khoan tường', 45000, 25000, 150, 'Đồ gia dụng', 'https://images.unsplash.com/photo-1595428774223-ef52624120d2?w=500'),
('Khăn lau đa năng microfiber 30x30cm (3 cái)', 'Khăn lau mềm mịn, thấm hút tốt, không xơ vải', 65000, 35000, 200, 'Đồ gia dụng', 'https://images.unsplash.com/photo-1610557892470-55d9e80c0bce?w=500'),

-- Dụng cụ vệ sinh
('Chổi lau nhà 360 độ có xô vắt', 'Chổi lau xoay 360°, sợi microfiber thấm nước tốt', 320000, 210000, 48, 'Dụng cụ vệ sinh', 'https://images.unsplash.com/photo-1563453392212-326f5e854473?w=500'),
('Bộ cọ rửa bát 3 món', 'Bộ cọ rửa bát silicon, cọ chai, miếng rửa tiện lợi', 75000, 45000, 110, 'Dụng cụ vệ sinh', 'https://images.unsplash.com/photo-1585421514738-01798e348b17?w=500'),
('Nước rửa chén Sunlight 3.6kg', 'Nước rửa chén chanh tinh khiết, túi tiết kiệm', 168000, 120000, 75, 'Dụng cụ vệ sinh', 'https://images.unsplash.com/photo-1563453392212-326f5e854473?w=500'),
('Túi rác tự huỷ sinh học 55x65cm (1 cuộn)', 'Túi rác màu đen, thân thiện môi trường, 20 chiếc/cuộn', 35000, 20000, 180, 'Dụng cụ vệ sinh', 'https://images.unsplash.com/photo-1611284446314-60a58ac0deb9?w=500'),

-- Đồ trang trí
('Chậu cây cảnh gốm sứ', 'Chậu gốm trắng tối giản, đường kính 15cm', 120000, 70000, 65, 'Đồ trang trí', 'https://images.unsplash.com/photo-1485955900006-10f4d324d411?w=500'),
('Đèn ngủ LED cảm ứng', 'Đèn ngủ silicon mềm, 3 chế độ ánh sáng ấm', 180000, 120000, 52, 'Đồ trang trí', 'https://images.unsplash.com/photo-1507608869274-d3177c8bb4c7?w=500'),
('Khung ảnh treo tường 20x30cm (3 khung)', 'Khung ảnh gỗ tự nhiên, kính trong suốt', 250000, 160000, 40, 'Đồ trang trí', 'https://images.unsplash.com/photo-1513519245088-0e12902e35ca?w=500'),
('Gương soi trang điểm để bàn', 'Gương tròn xoay 360°, đế gỗ sang trọng', 195000, 130000, 38, 'Đồ trang trí', 'https://images.unsplash.com/photo-1618220179428-22790b461013?w=500'),

-- Đồ dùng phòng ngủ
('Bộ chăn ga gối cotton 4 món', 'Bộ chăn ga cotton 100%, hoa văn tối giản, 1m8', 580000, 400000, 32, 'Đồ dùng phòng ngủ', 'https://images.unsplash.com/photo-1631049307264-da0ec9d70304?w=500'),
('Gối ôm cotton hơi cao su non', 'Gối ôm êm ái, vỏ cotton thoáng mát, ruột cao su', 320000, 220000, 55, 'Đồ dùng phòng ngủ', 'https://images.unsplash.com/photo-1584100936595-c0654b55a2e2?w=500'),
('Chăn điện sưởi ấm 160x180cm', 'Chăn điện an toàn, 3 mức nhiệt, tự ngắt khi quá nhiệt', 680000, 480000, 22, 'Đồ dùng phòng ngủ', 'https://images.unsplash.com/photo-1541123437800-1bb1317badc2?w=500'),
('Rèm cửa chống nắng 2 lớp', 'Rèm vải polyester cao cấp, chống nắng 90%, 2x2.5m', 420000, 290000, 28, 'Đồ dùng phòng ngủ', 'https://images.unsplash.com/photo-1616486338812-3dadae4b4ace?w=500');

-- ===========================================
-- VIEWS - Báo cáo và thống kê
-- ===========================================

-- View thống kê doanh thu theo sản phẩm
CREATE VIEW product_sales_summary AS
SELECT 
  p.id,
  p.name,
  p.category,
  p.price,
  p.cost_price,
  COUNT(oi.id) as total_orders,
  COALESCE(SUM(oi.quantity), 0) as total_quantity_sold,
  COALESCE(SUM(oi.subtotal), 0) as total_revenue,
  COALESCE(SUM(oi.quantity * p.cost_price), 0) as total_cost,
  COALESCE(SUM(oi.subtotal) - SUM(oi.quantity * p.cost_price), 0) as total_profit
FROM products p
LEFT JOIN order_items oi ON p.id = oi.product_id
LEFT JOIN orders o ON oi.order_id = o.id AND o.status != 'cancelled'
GROUP BY p.id, p.name, p.category, p.price, p.cost_price;

-- View thống kê đơn hàng
CREATE VIEW order_summary AS
SELECT 
  DATE(o.created_at) as order_date,
  COUNT(DISTINCT o.id) as total_orders,
  COUNT(DISTINCT CASE WHEN o.status = 'delivered' THEN o.id END) as delivered_orders,
  COUNT(DISTINCT CASE WHEN o.status = 'cancelled' THEN o.id END) as cancelled_orders,
  COALESCE(SUM(CASE WHEN o.status != 'cancelled' THEN o.total_amount END), 0) as total_revenue
FROM orders o
GROUP BY DATE(o.created_at)
ORDER BY order_date DESC;

-- ===========================================
-- COMMENTS - Mô tả các bảng
-- ===========================================
COMMENT ON TABLE products IS 'Bảng lưu trữ thông tin sản phẩm';
COMMENT ON TABLE orders IS 'Bảng lưu trữ thông tin đơn hàng';
COMMENT ON TABLE order_items IS 'Bảng lưu trữ chi tiết sản phẩm trong đơn hàng';

COMMENT ON COLUMN products.cost_price IS 'Giá vốn - dùng để tính lợi nhuận';
COMMENT ON COLUMN products.stock_quantity IS 'Số lượng tồn kho hiện tại';
COMMENT ON COLUMN order_items.unit_price IS 'Giá bán tại thời điểm đặt hàng - không thay đổi khi giá sản phẩm thay đổi';
COMMENT ON COLUMN order_items.subtotal IS 'Thành tiền = quantity × unit_price';
