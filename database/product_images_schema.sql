-- ===========================================
-- Bảng Product Images (Gallery)
-- ===========================================

CREATE TABLE IF NOT EXISTS product_images (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  image_url TEXT NOT NULL,
  storage_path TEXT NOT NULL,
  display_order INTEGER NOT NULL DEFAULT 0,
  is_cover BOOLEAN DEFAULT false,
  file_size INTEGER,
  width INTEGER,
  height INTEGER,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_product_images_product_id ON product_images(product_id);
CREATE INDEX IF NOT EXISTS idx_product_images_display_order ON product_images(product_id, display_order);
CREATE INDEX IF NOT EXISTS idx_product_images_is_cover ON product_images(product_id, is_cover);

-- Enable RLS
ALTER TABLE product_images ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Allow public read access to product_images" ON product_images
  FOR SELECT USING (true);

CREATE POLICY "Allow insert to product_images" ON product_images
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Allow update to product_images" ON product_images
  FOR UPDATE USING (true);

CREATE POLICY "Allow delete to product_images" ON product_images
  FOR DELETE USING (true);

-- ===========================================
-- Function: Cập nhật ảnh cover của product
-- ===========================================

CREATE OR REPLACE FUNCTION update_product_cover_image()
RETURNS TRIGGER AS $$
BEGIN
  -- Nếu ảnh mới được set là cover
  IF NEW.is_cover = true THEN
    -- Bỏ cover của các ảnh khác trong cùng product
    UPDATE product_images
    SET is_cover = false
    WHERE product_id = NEW.product_id AND id != NEW.id;
    
    -- Cập nhật image_url chính của product
    UPDATE products
    SET image_url = NEW.image_url
    WHERE id = NEW.product_id;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_product_cover
  AFTER INSERT OR UPDATE OF is_cover ON product_images
  FOR EACH ROW
  EXECUTE FUNCTION update_product_cover_image();

-- ===========================================
-- Function: Tự động sắp xếp display_order
-- ===========================================

CREATE OR REPLACE FUNCTION auto_assign_display_order()
RETURNS TRIGGER AS $$
DECLARE
  max_order INTEGER;
BEGIN
  IF NEW.display_order IS NULL OR NEW.display_order = 0 THEN
    SELECT COALESCE(MAX(display_order), 0) + 1
    INTO max_order
    FROM product_images
    WHERE product_id = NEW.product_id;
    
    NEW.display_order := max_order;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_auto_display_order
  BEFORE INSERT ON product_images
  FOR EACH ROW
  EXECUTE FUNCTION auto_assign_display_order();

-- Grant permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON product_images TO anon, authenticated;
