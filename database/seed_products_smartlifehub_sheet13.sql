-- ===========================================
-- SmartLife Hub - Seed Products From Sheet13
-- ===========================================
-- Nguon du lieu: anh bang gia nhap san pham SmartLifeHub - Sheet13.
--
-- Quy uoc seed:
-- - description va image_url de NULL de admin bo sung sau.
-- - stock_quantity mac dinh 10 neu cot "so luong trong kho" dang trong.
-- - category mac dinh "Chưa phân loại" neu cot "phan loai" dang trong.
-- - cost_price mac dinh 0 neu cot "gia nhap" dang trong.
-- - Neu thieu gia ban:
--   + price tam thoi = cost_price de thoa constraint price >= cost_price.
--   + price_on_request = true de UI hien nut "Lien he dat mua".
--   + is_active = true de van hien thi ngoai website.
-- - Neu co gia ban hop le: price_on_request = false, is_active = true.
--
-- Cach dung:
-- 1. Chay database/products_price_on_request_schema.sql de them cot price_on_request.
-- 2. Chay database/clear_product_catalog.sql neu muon xoa sach san pham cu.
-- 3. Chay file nay trong Supabase SQL Editor.
-- ===========================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

BEGIN;

DROP TABLE IF EXISTS seed_sheet13_inserted_products;
DROP TABLE IF EXISTS seed_sheet13_products;
DROP TABLE IF EXISTS seed_sheet13_products_raw;

CREATE TEMP TABLE seed_sheet13_products_raw (
  seed_order INTEGER NOT NULL,
  product_name TEXT NOT NULL,
  import_price NUMERIC(12, 2),
  selling_price NUMERIC(12, 2),
  stock_quantity INTEGER,
  category_name TEXT
) ON COMMIT DROP;

INSERT INTO seed_sheet13_products_raw (
  seed_order,
  product_name,
  import_price,
  selling_price,
  stock_quantity,
  category_name
)
VALUES
  (1, 'Similac Mom hương vani 400g', NULL, NULL, NULL, NULL),
  (2, 'Similac Mom hương vani 900g', NULL, NULL, NULL, NULL),
  (3, 'Similac Total Protection 0+ 380g', NULL, NULL, NULL, NULL),
  (4, 'Similac Total Protection 0+ 800g', NULL, NULL, NULL, NULL),
  (5, 'Similac Total Protection 1+ 800g', NULL, NULL, NULL, NULL),
  (6, 'Similac 110ml', NULL, NULL, NULL, NULL),
  (7, 'Grow Abbott 1+ 800g', NULL, NULL, NULL, NULL),
  (8, 'Grow Abbott 2+ 800g', NULL, NULL, NULL, NULL),
  (9, 'Grow Abbott gold 3+ 800g', NULL, NULL, NULL, NULL),
  (10, 'Grow Abbott gold 6+ 800g', NULL, NULL, NULL, NULL),
  (11, 'Grow 110ml', NULL, NULL, NULL, NULL),
  (12, 'Pediasure hương vani 380g', NULL, NULL, NULL, NULL),
  (13, 'Pediasure hương vani 800g', NULL, NULL, NULL, NULL),
  (14, 'Pediasure hương vani 180ml', NULL, NULL, NULL, NULL),
  (15, 'Pediasure hương socolca 180ml', NULL, NULL, NULL, NULL),
  (16, 'Ensure Gold 800g', NULL, NULL, NULL, NULL),
  (17, 'Ensure Gold 380g', NULL, NULL, NULL, NULL),
  (18, 'Ensure immune', NULL, NULL, NULL, NULL),
  (19, 'Vital 1.5kcal 200ml', NULL, NULL, NULL, NULL),
  (20, 'Glucerna hương vani 800g', NULL, NULL, NULL, NULL),
  (21, 'Prosure 380g', NULL, NULL, NULL, NULL),
  (22, 'Calcium Liposomial Bambi', NULL, NULL, NULL, NULL),
  (23, 'Hi Calmax', 189000, 315000, 5, 'Bổ sung Calci cho trẻ em'),
  (24, 'Calcium citrate 900 gold', NULL, NULL, NULL, NULL),
  (25, 'VitK2-VitD3 Bambi', 168000, 280000, 5, 'Bổ sung D3K2'),
  (26, 'ZinC Liposomiale Bambi', 204000, 340000, 5, 'Bổ sung kẽm'),
  (27, 'Kẽm HiZin C', 189000, 315000, 5, 'Bổ sung kẽm'),
  (28, 'Probiotic Bambi', NULL, NULL, NULL, NULL),
  (29, 'DHA Drop Bambi', 198000, 330000, 5, 'Phát triển trí não trẻ em'),
  (30, 'Krill oil drop', 198250, 295000, 1, 'Phát triển trí não trẻ em'),
  (31, 'Omega 3 Blue', 216000, 360000, 2, 'Phát triển trí não trẻ em'),
  (32, 'Immuguard Junior', 198250, 295000, 5, 'Tăng cường đề kháng, hỗ trợ tiêu hoá'),
  (33, 'Vitamirin Bambi', NULL, NULL, NULL, NULL),
  (34, 'Multivitamin Junior', 198250, 295000, 3, 'Bổ sung vitamin'),
  (35, 'PEGinpol', 212000, 265000, 10, 'Nhuận tràng'),
  (36, 'Siro ngủ ngon Buona Circadiem', NULL, NULL, NULL, NULL),
  (37, 'Siro ăn ngon Buona Energia Oro', NULL, NULL, NULL, NULL),
  (38, 'ImuVital', 189000, 315000, 5, 'Tăng cường đề kháng, bổ sung vitamin'),
  (39, 'Men vi sinh Simbiosistem lọ', 251250, 335000, 5, 'Men vi sinh'),
  (40, 'Men vi sinh Simbiosistem', NULL, NULL, NULL, NULL),
  (41, 'Nhỏ mũi Nebial 3%', 184000, 230000, 5, 'Nhỏ mũi'),
  (42, 'Vita Ginko', 189000, 315000, 5, 'Bổ não cho người lớn'),
  (43, 'Vita Coenzym Q10', 207000, 345000, 5, 'Bổ tim'),
  (44, 'TPBVSK FFC GABA', NULL, NULL, NULL, NULL),
  (45, 'YMUMOLATO Vitamin C', NULL, NULL, NULL, NULL),
  (46, 'DELIWON', 256750, 395000, 5, 'Bổ gan'),
  (47, 'EPO WON', 266500, 410000, 3, 'Cân bằng nội tiết tố nữ, cân bằng, làm đẹp da'),
  (48, 'Alpha Omega 3-6-9', 217750, 335000, 3, 'Bổ sung Omega'),
  (49, 'FytozinC', NULL, NULL, NULL, NULL),
  (50, 'Probiotics Oceri', NULL, NULL, NULL, NULL),
  (51, 'Tenbimus', NULL, NULL, NULL, NULL),
  (52, 'Lactofibre', NULL, NULL, NULL, NULL),
  (53, 'Seltitus', NULL, NULL, NULL, NULL),
  (54, 'Bronchokid', NULL, NULL, NULL, NULL),
  (55, 'Natu Pox 102', NULL, NULL, NULL, NULL),
  (56, 'Fomeal Basic Soup', NULL, NULL, NULL, NULL),
  (57, 'Fomeal Peptide', NULL, NULL, NULL, NULL),
  (58, 'Hipp Combiotic 1 800g', 705000, NULL, 2, 'Sữa bột bò'),
  (59, 'Hipp Combiotic 2 800g', 700000, NULL, 2, 'Sữa bột bò'),
  (60, 'Hipp Combiotic 3 800g', 700000, NULL, 2, 'Sữa bột bò'),
  (61, 'Hipp Combiotic 4', NULL, NULL, NULL, NULL),
  (62, 'Meiji 0-1', 480000, NULL, 2, 'Sữa bột cho trẻ 0-1 tuổi'),
  (63, 'Meiji 1-3', 365000, NULL, 2, 'Sữa bột cho trẻ 1-3 tuổi'),
  (64, 'Meiji thanh 0-1', 515000, NULL, 2, 'Sữa thanh cho trẻ < 1 tuổi'),
  (65, 'Optimum A2 tím', 245000, NULL, 3, 'Sữa nước cho trẻ'),
  (66, 'Grow plus bạc', 214000, NULL, 3, 'Sữa nước cho trẻ'),
  (67, 'Bio Island milk calcium Bone Care', 560000, NULL, 3, 'Bổ sung Calci người lớn'),
  (68, 'Bio Island milk calcium For Kid', 485000, NULL, 3, 'Bổ sung Calci trẻ em'),
  (69, 'Goat 1', 1094000, NULL, 1, 'Sữa bột dê'),
  (70, 'Goat 2', NULL, NULL, NULL, NULL),
  (71, 'Goat 3', NULL, NULL, NULL, NULL),
  (72, 'Bioamicus Complete', 384000, 480000, 5, 'Men vi sinh'),
  (73, 'Bioamicus D3K2', 264000, 330000, 15, 'Bổ sung D3K2'),
  (74, 'Bioamicus D3', NULL, NULL, NULL, NULL),
  (75, 'Bioamicus Omega 3', 308000, 385000, 5, 'Phát triển trí não cho trẻ em'),
  (76, 'Kẽm Biolizin', 252000, 315000, 15, 'Bổ sung kẽm'),
  (77, 'Ferrolip Kids', 242307, 315000, 13, 'Bổ sung sắt cho trẻ em'),
  (78, 'Ferrolip', 308000, 385000, 5, 'Bổ sung sắt người lớn'),
  (79, 'Befoma', NULL, NULL, NULL, NULL),
  (80, 'EasyCol Baby', 300000, 420000, 7, 'Bổ sung men lactase');

CREATE TEMP TABLE seed_sheet13_products ON COMMIT DROP AS
SELECT DISTINCT ON (LOWER(product_name))
  seed_order,
  product_name,
  COALESCE(import_price, 0) AS cost_price,
  CASE
    WHEN selling_price IS NULL THEN COALESCE(import_price, 0)
    WHEN selling_price < COALESCE(import_price, 0) THEN COALESCE(import_price, 0)
    ELSE selling_price
  END AS price,
  COALESCE(stock_quantity, 10) AS stock_quantity,
  category_name,
  selling_price IS NULL OR selling_price <= 0 AS price_on_request,
  true AS is_active
FROM (
  SELECT
    seed_order,
    NULLIF(BTRIM(REGEXP_REPLACE(product_name, '[[:space:]]+', ' ', 'g')), '') AS product_name,
    import_price,
    selling_price,
    stock_quantity,
    COALESCE(
      NULLIF(BTRIM(REGEXP_REPLACE(category_name, '[[:space:]]+', ' ', 'g')), ''),
      'Chưa phân loại'
    ) AS category_name
  FROM seed_sheet13_products_raw
) normalized
WHERE product_name IS NOT NULL
ORDER BY LOWER(product_name), seed_order;

INSERT INTO categories (id, name, slug, is_active)
SELECT
  uuid_generate_v5(uuid_ns_url(), 'smartlifehub-sheet13-category:' || category_name) AS id,
  category_name AS name,
  'sheet13-' || SUBSTR(MD5(category_name), 1, 12) AS slug,
  true AS is_active
FROM (
  SELECT DISTINCT category_name
  FROM seed_sheet13_products
) category_rows
ON CONFLICT (id) DO NOTHING;

CREATE TEMP TABLE seed_sheet13_inserted_products ON COMMIT DROP AS
WITH inserted_products AS (
  INSERT INTO products (
    id,
    name,
    description,
    price,
    discount_percent,
    discount_start_at,
    discount_end_at,
    cost_price,
    stock_quantity,
    image_url,
    category,
    price_on_request,
    is_active
  )
  SELECT
    uuid_generate_v5(uuid_ns_url(), 'smartlifehub-sheet13-product:' || product_name) AS id,
    product_name AS name,
    NULL AS description,
    price,
    0 AS discount_percent,
    NULL AS discount_start_at,
    NULL AS discount_end_at,
    cost_price,
    stock_quantity,
    NULL AS image_url,
    category_name AS category,
    price_on_request,
    is_active
  FROM seed_sheet13_products
  ORDER BY seed_order
  ON CONFLICT (id) DO NOTHING
  RETURNING id, name, cost_price, stock_quantity
)
SELECT *
FROM inserted_products;

INSERT INTO product_categories (product_id, category_id)
SELECT
  uuid_generate_v5(uuid_ns_url(), 'smartlifehub-sheet13-product:' || product_name) AS product_id,
  uuid_generate_v5(uuid_ns_url(), 'smartlifehub-sheet13-category:' || category_name) AS category_id
FROM seed_sheet13_products
ON CONFLICT (product_id, category_id) DO NOTHING;

INSERT INTO stock_inbound (
  product_id,
  quantity_added,
  cost_price_at_time,
  supplier,
  notes,
  created_by,
  created_at
)
SELECT
  id,
  stock_quantity,
  cost_price,
  'Sheet13',
  'Seed tồn kho ban đầu từ bảng giá nhập SmartLifeHub - Sheet13',
  'Seed script',
  NOW()
FROM seed_sheet13_inserted_products
WHERE stock_quantity > 0;

COMMIT;
