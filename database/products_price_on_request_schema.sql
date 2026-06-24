-- ===========================================
-- Products - Price On Request Flag
-- ===========================================
-- Dung cho san pham chua co gia ban cong khai:
-- - San pham van co the is_active = true de hien thi ngoai website.
-- - UI public se hien "Lien he dat mua" thay vi them vao gio hang.
-- - price van bat buoc theo schema hien tai, nen co the luu gia tam/noi bo.
-- ===========================================

ALTER TABLE products
  ADD COLUMN IF NOT EXISTS price_on_request BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN products.price_on_request IS
  'True neu san pham chua co gia ban cong khai va can lien he de dat mua.';
