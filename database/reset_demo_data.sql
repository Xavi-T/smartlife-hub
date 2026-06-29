-- ===========================================
-- SmartLife Hub - Reset & Demo Data
-- ===========================================
-- CANH BAO: Script nay xoa du lieu nghiep vu hien co trong schema public.
-- Nen backup database truoc khi chay tren moi truong that.
--
-- Script giu lai:
-- - auth.users va thong tin dang nhap Supabase
-- - File vat ly trong Supabase Storage hoac thu muc public
--
-- Cach dung goi y:
-- 1. Chay day du cac file schema/migration trong database/ truoc.
-- 2. Mo Supabase SQL Editor.
-- 3. Dan toan bo file nay va Run.
-- 4. Co the sua lai data demo ben duoi theo nhu cau cua quan.
-- ===========================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

BEGIN;

-- Xoa du lieu cu theo thu tu an toan. TRUNCATE khong fire trigger ton kho,
-- nen script cung reset products va order_items trong cung transaction.
DO $reset$
DECLARE
  v_table_name TEXT;
BEGIN
  FOREACH v_table_name IN ARRAY ARRAY[
    'nutrition_assessments',
    'nutrition_clients',
    'nutrition_articles',
    'nutrition_categories',
    'priority_customers',
    'customer_segment_settings',
    'stock_inbound',
    'product_images',
    'product_variants',
    'product_categories',
    'categories',
    'order_items',
    'orders',
    'products',
    'audit_logs',
    'site_media_assets'
  ]
  LOOP
    IF to_regclass('public.' || v_table_name) IS NOT NULL THEN
      EXECUTE format(
        'TRUNCATE TABLE public.%I RESTART IDENTITY CASCADE',
        v_table_name
      );
    END IF;
  END LOOP;
END;
$reset$;

DO $seed$
DECLARE
  v_cat_food UUID := uuid_generate_v4();
  v_cat_supplement UUID := uuid_generate_v4();
  v_cat_drink UUID := uuid_generate_v4();
  v_cat_tool UUID := uuid_generate_v4();

  v_p_oats UUID := uuid_generate_v4();
  v_p_chia UUID := uuid_generate_v4();
  v_p_granola UUID := uuid_generate_v4();
  v_p_protein UUID := uuid_generate_v4();
  v_p_milk UUID := uuid_generate_v4();
  v_p_tea UUID := uuid_generate_v4();
  v_p_scale UUID := uuid_generate_v4();
  v_p_meal_prep UUID := uuid_generate_v4();

  v_order_1 UUID := uuid_generate_v4();
  v_order_2 UUID := uuid_generate_v4();
  v_order_3 UUID := uuid_generate_v4();

  v_ncat_weight UUID := uuid_generate_v4();
  v_ncat_healthy UUID := uuid_generate_v4();
  v_ncat_family UUID := uuid_generate_v4();
  v_ncat_metabolic UUID := uuid_generate_v4();

  v_article_breakfast UUID := uuid_generate_v4();
  v_article_weight UUID := uuid_generate_v4();
  v_article_family UUID := uuid_generate_v4();

  v_client_1 UUID := uuid_generate_v4();
  v_client_2 UUID := uuid_generate_v4();
  v_client_3 UUID := uuid_generate_v4();
BEGIN
  -- Media mac dinh cho logo/banner. Duong dan nay dung file co san trong public/.
  INSERT INTO site_media_assets (
    media_key,
    purpose,
    alt_text,
    file_name,
    mime_type,
    file_size,
    image_url,
    storage_path,
    display_order,
    width,
    height
  )
  VALUES
    (
      'site_logo_default',
      'site_logo',
      'SmartLife Hub',
      'logoSH.png',
      'image/png',
      1,
      '/logoSH.png',
      'demo/site/logoSH.png',
      1,
      NULL,
      NULL
    ),
    (
      'homepage_banner_nutrition_consulting',
      'homepage_banner',
      'Tư vấn dinh dưỡng cá nhân tại SmartLife Hub',
      'banner-nutrition-consulting.svg',
      'image/svg+xml',
      1,
      '/banners/banner-nutrition-consulting.svg',
      'demo/site/banner-nutrition-consulting.svg',
      1,
      NULL,
      NULL
    ),
    (
      'homepage_banner_family_health',
      'homepage_banner',
      'Giải pháp dinh dưỡng cho tương lai khoẻ',
      'banner-family-health.svg',
      'image/svg+xml',
      1,
      '/banners/banner-family-health.svg',
      'demo/site/banner-family-health.svg',
      2,
      NULL,
      NULL
    ),
    (
      'homepage_banner_mom_baby_milk',
      'homepage_banner',
      'Sữa mẹ bầu và trẻ em',
      'banner-mom-baby-milk.svg',
      'image/svg+xml',
      1,
      '/banners/banner-mom-baby-milk.svg',
      'demo/site/banner-mom-baby-milk.svg',
      3,
      NULL,
      NULL
    ),
    (
      'homepage_banner_healthy_products',
      'homepage_banner',
      'Gian hàng dinh dưỡng lành mạnh',
      'banner-healthy-products.svg',
      'image/svg+xml',
      1,
      '/banners/banner-healthy-products.svg',
      'demo/site/banner-healthy-products.svg',
      4,
      NULL,
      NULL
    );

  -- Danh muc san pham.
  INSERT INTO categories (id, name, slug, is_active)
  VALUES
    (v_cat_food, 'Đồ ăn lành mạnh', 'do-an-lanh-manh', true),
    (v_cat_supplement, 'Thực phẩm bổ sung', 'thuc-pham-bo-sung', true),
    (v_cat_drink, 'Đồ uống tốt cho sức khỏe', 'do-uong-tot-cho-suc-khoe', true),
    (v_cat_tool, 'Dụng cụ bếp healthy', 'dung-cu-bep-healthy', true);

  -- San pham demo. Ton kho o day la so ban dau, order_items phia duoi se tu tru kho.
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
    is_active
  )
  VALUES
    (
      v_p_oats,
      'Yến mạch cán dẹt hữu cơ 1kg',
      '<p>Yến mạch cán dẹt phù hợp cho bữa sáng, overnight oats hoặc cháo yến mạch. Sản phẩm dễ dùng cho khách cần tăng chất xơ và kiểm soát năng lượng.</p>',
      89000,
      0,
      NULL,
      NULL,
      62000,
      80,
      'https://images.unsplash.com/photo-1517673132405-a56a62b18caf?w=900',
      'Đồ ăn lành mạnh',
      true
    ),
    (
      v_p_chia,
      'Hạt chia Úc 500g',
      '<p>Hạt chia giàu chất xơ, có thể dùng cùng sữa chua, sinh tố hoặc nước trái cây. Phù hợp làm bữa phụ nhẹ cho gia đình.</p>',
      125000,
      0,
      NULL,
      NULL,
      85000,
      60,
      'https://images.unsplash.com/photo-1505576399279-565b52d4ac71?w=900',
      'Đồ ăn lành mạnh',
      true
    ),
    (
      v_p_granola,
      'Granola ít đường 500g',
      '<p>Granola ít đường, dùng cùng sữa chua hoặc sữa hạt. Gợi ý khẩu phần: 30-40g mỗi lần, kết hợp thêm trái cây tươi.</p>',
      145000,
      10,
      NOW() - INTERVAL '1 day',
      NOW() + INTERVAL '14 days',
      95000,
      45,
      'https://images.unsplash.com/photo-1494597564530-871f2b93ac55?w=900',
      'Đồ ăn lành mạnh',
      true
    ),
    (
      v_p_protein,
      'Bột protein thực vật 900g',
      '<p>Bột protein nguồn thực vật, dùng bổ sung trong khẩu phần khi khách khó đạt nhu cầu đạm qua bữa ăn chính.</p>',
      520000,
      0,
      NULL,
      NULL,
      385000,
      30,
      'https://images.unsplash.com/photo-1593095948071-474c5cc2989d?w=900',
      'Thực phẩm bổ sung',
      true
    ),
    (
      v_p_milk,
      'Sữa hạt không đường 1L',
      '<p>Sữa hạt không đường, dùng kèm yến mạch, granola hoặc làm sinh tố. Phù hợp cho khách muốn giảm đường thêm vào.</p>',
      45000,
      0,
      NULL,
      NULL,
      31000,
      120,
      'https://images.unsplash.com/photo-1551462147-37885acc36f1?w=900',
      'Đồ uống tốt cho sức khỏe',
      true
    ),
    (
      v_p_tea,
      'Trà gạo lứt túi lọc',
      '<p>Trà gạo lứt túi lọc, hương vị nhẹ, dễ dùng sau bữa ăn. Không thay thế thuốc hoặc chỉ định điều trị.</p>',
      69000,
      0,
      NULL,
      NULL,
      42000,
      75,
      'https://images.unsplash.com/photo-1544787219-7f47ccb76574?w=900',
      'Đồ uống tốt cho sức khỏe',
      true
    ),
    (
      v_p_scale,
      'Cân điện tử nhà bếp',
      '<p>Cân bếp nhỏ gọn giúp khách theo dõi khẩu phần chính xác hơn khi chuẩn bị bữa ăn tại nhà.</p>',
      159000,
      0,
      NULL,
      NULL,
      105000,
      25,
      'https://images.unsplash.com/photo-1556909114-f6e7ad7d3136?w=900',
      'Dụng cụ bếp healthy',
      true
    ),
    (
      v_p_meal_prep,
      'Hộp chia khẩu phần meal prep',
      '<p>Hộp chia khẩu phần 3 ngăn, tiện chuẩn bị bữa ăn đi làm hoặc theo dõi lượng tinh bột, đạm và rau trong mỗi bữa.</p>',
      99000,
      0,
      NULL,
      NULL,
      65000,
      50,
      'https://images.unsplash.com/photo-1543352634-a1c51d9f1fa7?w=900',
      'Dụng cụ bếp healthy',
      true
    );

  INSERT INTO product_categories (product_id, category_id)
  VALUES
    (v_p_oats, v_cat_food),
    (v_p_chia, v_cat_food),
    (v_p_granola, v_cat_food),
    (v_p_protein, v_cat_supplement),
    (v_p_milk, v_cat_drink),
    (v_p_tea, v_cat_drink),
    (v_p_scale, v_cat_tool),
    (v_p_meal_prep, v_cat_tool);

  INSERT INTO product_images (
    product_id,
    image_url,
    storage_path,
    display_order,
    is_cover,
    file_size,
    width,
    height
  )
  VALUES
    (v_p_oats, 'https://images.unsplash.com/photo-1517673132405-a56a62b18caf?w=900', 'demo/products/yen-mach-cover.jpg', 1, true, 120000, 900, 600),
    (v_p_chia, 'https://images.unsplash.com/photo-1505576399279-565b52d4ac71?w=900', 'demo/products/hat-chia-cover.jpg', 1, true, 120000, 900, 600),
    (v_p_granola, 'https://images.unsplash.com/photo-1494597564530-871f2b93ac55?w=900', 'demo/products/granola-cover.jpg', 1, true, 120000, 900, 600),
    (v_p_protein, 'https://images.unsplash.com/photo-1593095948071-474c5cc2989d?w=900', 'demo/products/protein-cover.jpg', 1, true, 120000, 900, 600),
    (v_p_milk, 'https://images.unsplash.com/photo-1551462147-37885acc36f1?w=900', 'demo/products/sua-hat-cover.jpg', 1, true, 120000, 900, 600),
    (v_p_tea, 'https://images.unsplash.com/photo-1544787219-7f47ccb76574?w=900', 'demo/products/tra-gao-lut-cover.jpg', 1, true, 120000, 900, 600),
    (v_p_scale, 'https://images.unsplash.com/photo-1556909114-f6e7ad7d3136?w=900', 'demo/products/can-bep-cover.jpg', 1, true, 120000, 900, 600),
    (v_p_meal_prep, 'https://images.unsplash.com/photo-1543352634-a1c51d9f1fa7?w=900', 'demo/products/hop-meal-prep-cover.jpg', 1, true, 120000, 900, 600);

  INSERT INTO product_variants (
    product_id,
    variant_name,
    cost_price,
    price,
    image_url,
    sort_order,
    is_active
  )
  VALUES
    (v_p_granola, 'Hũ 500g', 95000, 145000, 'https://images.unsplash.com/photo-1494597564530-871f2b93ac55?w=900', 1, true),
    (v_p_granola, 'Combo 2 hũ 500g', 185000, 275000, 'https://images.unsplash.com/photo-1494597564530-871f2b93ac55?w=900', 2, true),
    (v_p_protein, 'Vị cacao', 385000, 520000, 'https://images.unsplash.com/photo-1593095948071-474c5cc2989d?w=900', 1, true),
    (v_p_protein, 'Vị vanilla', 390000, 535000, 'https://images.unsplash.com/photo-1593095948071-474c5cc2989d?w=900', 2, true),
    (v_p_milk, 'Lốc 6 hộp', 178000, 255000, 'https://images.unsplash.com/photo-1551462147-37885acc36f1?w=900', 1, true);

  INSERT INTO stock_inbound (
    product_id,
    quantity_added,
    cost_price_at_time,
    supplier,
    notes,
    created_by,
    created_at
  )
  VALUES
    (v_p_oats, 80, 62000, 'Nhà cung cấp An Nhiên', 'Nhập kho demo ban đầu', 'Seed script', NOW() - INTERVAL '20 days'),
    (v_p_chia, 60, 85000, 'Nhà cung cấp An Nhiên', 'Nhập kho demo ban đầu', 'Seed script', NOW() - INTERVAL '20 days'),
    (v_p_granola, 45, 95000, 'Bếp granola nhà làm', 'Nhập kho demo ban đầu', 'Seed script', NOW() - INTERVAL '18 days'),
    (v_p_protein, 30, 385000, 'Nhà phân phối HealthCare', 'Nhập kho demo ban đầu', 'Seed script', NOW() - INTERVAL '17 days'),
    (v_p_milk, 120, 31000, 'Đại lý sữa hạt', 'Nhập kho demo ban đầu', 'Seed script', NOW() - INTERVAL '15 days'),
    (v_p_tea, 75, 42000, 'Nhà cung cấp trà Việt', 'Nhập kho demo ban đầu', 'Seed script', NOW() - INTERVAL '15 days'),
    (v_p_scale, 25, 105000, 'Đồ bếp Minh Phát', 'Nhập kho demo ban đầu', 'Seed script', NOW() - INTERVAL '12 days'),
    (v_p_meal_prep, 50, 65000, 'Đồ bếp Minh Phát', 'Nhập kho demo ban đầu', 'Seed script', NOW() - INTERVAL '12 days');

  -- Don hang demo. total_amount se duoc trigger tinh lai sau khi insert order_items.
  INSERT INTO orders (
    id,
    customer_name,
    customer_phone,
    customer_address,
    total_amount,
    status,
    notes,
    checkout_method,
    payment_method,
    payment_confirmed,
    payment_confirmed_at,
    payment_confirmed_by,
    created_at
  )
  VALUES
    (
      v_order_1,
      'Nguyễn Minh Anh',
      '0901234567',
      '12 Nguyễn Trãi, Thanh Xuân, Hà Nội',
      0,
      'completed',
      'Khách đang theo chế độ giảm cân nhẹ, ưu tiên ít đường.',
      'bank_transfer',
      'bank_transfer',
      true,
      NOW() - INTERVAL '5 days',
      'Seed script',
      NOW() - INTERVAL '5 days'
    ),
    (
      v_order_2,
      'Trần Quốc Huy',
      '0912345678',
      '45 Lê Văn Sỹ, Quận 3, TP. Hồ Chí Minh',
      0,
      'shipping',
      'Giao buổi chiều, gọi trước khi đến.',
      'cod',
      'cod',
      false,
      NULL,
      NULL,
      NOW() - INTERVAL '2 days'
    ),
    (
      v_order_3,
      'Lê Thu Hà',
      '0987654321',
      '88 Bạch Đằng, Hải Châu, Đà Nẵng',
      0,
      'pending',
      'Khách hỏi thêm tư vấn bữa phụ cho gia đình.',
      'cod',
      'cod',
      false,
      NULL,
      NULL,
      NOW() - INTERVAL '8 hours'
    );

  INSERT INTO order_items (
    order_id,
    product_id,
    quantity,
    unit_price,
    subtotal
  )
  VALUES
    (v_order_1, v_p_chia, 2, 125000, 250000),
    (v_order_1, v_p_granola, 1, 130500, 130500),
    (v_order_1, v_p_milk, 4, 45000, 180000),
    (v_order_2, v_p_protein, 1, 520000, 520000),
    (v_order_2, v_p_oats, 2, 89000, 178000),
    (v_order_2, v_p_meal_prep, 1, 99000, 99000),
    (v_order_3, v_p_tea, 2, 69000, 138000),
    (v_order_3, v_p_scale, 1, 159000, 159000);

  -- Cau hinh khach uu tien va mot vai khach demo.
  INSERT INTO customer_segment_settings (
    segment_key,
    segment_label,
    min_delivered_orders,
    min_total_spent,
    discount_percent,
    is_priority,
    sort_order
  )
  VALUES
    ('new', 'Khách mới', 1, 0, 0, false, 1),
    ('regular', 'Khách quen', 2, 0, 5, true, 2),
    ('loyal', 'Khách thân thiết', 3, 0, 10, true, 3),
    ('nutrition_client', 'Khách tư vấn dinh dưỡng', 1, 0, 7, true, 4);

  INSERT INTO priority_customers (
    customer_phone,
    customer_name,
    customer_segment,
    discount_percent,
    total_orders_snapshot,
    delivered_orders_snapshot,
    total_spent_snapshot,
    source,
    notes,
    is_active,
    last_order_at
  )
  SELECT
    '0901234567',
    'Nguyễn Minh Anh',
    'nutrition_client',
    7,
    1,
    1,
    total_amount,
    'manual',
    'Khách có hồ sơ tư vấn dinh dưỡng, ưu tiên gợi ý sản phẩm ít đường.',
    true,
    created_at
  FROM orders
  WHERE id = v_order_1;

  INSERT INTO priority_customers (
    customer_phone,
    customer_name,
    customer_segment,
    discount_percent,
    total_orders_snapshot,
    delivered_orders_snapshot,
    total_spent_snapshot,
    source,
    notes,
    is_active,
    last_order_at
  )
  SELECT
    '0912345678',
    'Trần Quốc Huy',
    'regular',
    5,
    1,
    0,
    total_amount,
    'manual',
    'Khách quan tâm sản phẩm bổ sung đạm và meal prep.',
    true,
    created_at
  FROM orders
  WHERE id = v_order_2;

  -- Danh muc va bai viet dinh duong.
  INSERT INTO nutrition_categories (id, name, slug, description, is_active)
  VALUES
    (v_ncat_weight, 'Giảm cân lành mạnh', 'giam-can-lanh-manh', 'Kiến thức giảm cân an toàn, dễ áp dụng trong đời sống hằng ngày.', true),
    (v_ncat_healthy, 'Ăn lành mạnh', 'an-lanh-manh', 'Thói quen ăn uống cân bằng cho gia đình.', true),
    (v_ncat_family, 'Dinh dưỡng gia đình', 'dinh-duong-gia-dinh', 'Gợi ý bữa ăn, bữa phụ và lựa chọn thực phẩm cho gia đình.', true),
    (v_ncat_metabolic, 'Bệnh lý chuyển hóa', 'benh-ly-chuyen-hoa', 'Nội dung tham khảo cho tiểu đường, mỡ máu và sức khỏe chuyển hóa.', true);

  INSERT INTO nutrition_articles (
    id,
    title,
    slug,
    excerpt,
    content,
    cover_image_url,
    category_id,
    author_name,
    status,
    related_product_ids,
    published_at,
    created_at
  )
  VALUES
    (
      v_article_breakfast,
      'Cách xây dựng bữa sáng đủ chất nhưng nhẹ bụng',
      'bua-sang-du-chat-nhe-bung',
      'Một công thức đơn giản để chuẩn bị bữa sáng có tinh bột tốt, chất đạm, chất béo tốt và chất xơ.',
      $html$<h2>Nguyên tắc nhanh</h2><p>Bữa sáng nên có một nguồn tinh bột hấp thu chậm, một nguồn đạm, một ít chất béo tốt và rau hoặc trái cây. Với khách bận rộn, yến mạch, sữa hạt, hạt chia và sữa chua là nhóm dễ chuẩn bị trước.</p><ul><li>Chọn khẩu phần vừa đủ, không cần ăn quá no.</li><li>Ưu tiên ít đường thêm vào.</li><li>Theo dõi cảm giác đói sau 3-4 giờ để điều chỉnh lượng ăn.</li></ul><p>Nội dung này mang tính giáo dục, không thay thế tư vấn cá nhân khi khách có bệnh lý nền.</p>$html$,
      'https://images.unsplash.com/photo-1494597564530-871f2b93ac55?w=1200',
      v_ncat_healthy,
      'BS. Dinh dưỡng',
      'published',
      ARRAY[v_p_oats, v_p_chia, v_p_granola, v_p_milk]::UUID[],
      NOW() - INTERVAL '7 days',
      NOW() - INTERVAL '7 days'
    ),
    (
      v_article_weight,
      'Nguyên tắc giảm cân bền vững cho người bận rộn',
      'nguyen-tac-giam-can-ben-vung-cho-nguoi-ban-ron',
      'Giảm cân hiệu quả hơn khi kiểm soát năng lượng, tăng đạm vừa đủ, ngủ tốt và duy trì vận động đều.',
      $html$<h2>Không cần bắt đầu quá phức tạp</h2><p>Với đa số khách hàng, mục tiêu tốt là giảm năng lượng vừa phải, tăng lượng đạm trong ngày và chuẩn bị sẵn một vài bữa đơn giản. Việc cân khẩu phần trong 1-2 tuần đầu giúp khách hiểu lượng ăn thực tế.</p><ul><li>Mỗi bữa có 1 phần đạm nạc hoặc đạm thực vật.</li><li>Nửa đĩa là rau hoặc thực phẩm giàu chất xơ.</li><li>Giảm nước ngọt, bánh kẹo và món chiên nhiều dầu.</li></ul><p>Nếu khách có tiểu đường, bệnh thận, đang mang thai hoặc dùng thuốc, cần cá nhân hóa kế hoạch.</p>$html$,
      'https://images.unsplash.com/photo-1543352634-a1c51d9f1fa7?w=1200',
      v_ncat_weight,
      'BS. Dinh dưỡng',
      'published',
      ARRAY[v_p_meal_prep, v_p_scale, v_p_granola, v_p_protein]::UUID[],
      NOW() - INTERVAL '4 days',
      NOW() - INTERVAL '4 days'
    ),
    (
      v_article_family,
      'Gợi ý bữa phụ lành mạnh cho gia đình',
      'goi-y-bua-phu-lanh-manh-cho-gia-dinh',
      'Một vài ý tưởng bữa phụ dễ chuẩn bị, phù hợp cho cả người lớn và trẻ lớn trong gia đình.',
      $html$<h2>Bữa phụ nên hỗ trợ bữa chính</h2><p>Bữa phụ lành mạnh giúp giảm ăn vặt ngẫu hứng và ổn định năng lượng trong ngày. Có thể chọn sữa chua không đường với hạt chia, trái cây tươi, trà gạo lứt hoặc một khẩu phần granola nhỏ.</p><p>Khi chuẩn bị cho trẻ nhỏ, cần chú ý độ tuổi, nguy cơ hóc nghẹn và dị ứng thực phẩm.</p>$html$,
      'https://images.unsplash.com/photo-1505576399279-565b52d4ac71?w=1200',
      v_ncat_family,
      'BS. Dinh dưỡng',
      'draft',
      ARRAY[v_p_chia, v_p_tea, v_p_milk, v_p_granola]::UUID[],
      NULL,
      NOW() - INTERVAL '1 day'
    );

  -- Ho so khach tu van dinh duong.
  INSERT INTO nutrition_clients (
    id,
    full_name,
    phone,
    gender,
    birth_date,
    height_cm,
    weight_kg,
    activity_level,
    goal,
    medical_notes,
    allergies,
    doctor_notes,
    status,
    consent_given,
    consent_at,
    created_at
  )
  VALUES
    (
      v_client_1,
      'Nguyễn Minh Anh',
      '0901234567',
      'female',
      DATE '1992-04-12',
      158,
      62,
      'light',
      'lose_weight',
      'Thỉnh thoảng đau dạ dày nhẹ, chưa ghi nhận bệnh mạn tính.',
      'Không rõ dị ứng.',
      'Mục tiêu giảm 3-4kg trong 3 tháng, ưu tiên bữa sáng dễ chuẩn bị.',
      'active',
      true,
      NOW() - INTERVAL '6 days',
      NOW() - INTERVAL '6 days'
    ),
    (
      v_client_2,
      'Trần Quốc Huy',
      '0912345678',
      'male',
      DATE '1988-08-23',
      172,
      76,
      'moderate',
      'improve_health',
      'Ngồi làm việc nhiều, tập gym 3 buổi mỗi tuần.',
      'Không ăn được hải sản.',
      'Tăng đạm trong bữa chính, theo dõi vòng bụng và giấc ngủ.',
      'active',
      true,
      NOW() - INTERVAL '3 days',
      NOW() - INTERVAL '3 days'
    ),
    (
      v_client_3,
      'Lê Thu Hà',
      '0987654321',
      'female',
      DATE '1990-11-05',
      160,
      54,
      'sedentary',
      'maintain',
      'Muốn tư vấn bữa phụ lành mạnh cho gia đình.',
      NULL,
      'Chưa có đánh giá chi tiết, hẹn đo chỉ số trong lần tới.',
      'new',
      true,
      NOW() - INTERVAL '8 hours',
      NOW() - INTERVAL '8 hours'
    );

  INSERT INTO nutrition_assessments (
    client_id,
    assessed_at,
    age_years,
    gender,
    height_cm,
    weight_kg,
    activity_level,
    goal,
    bmi,
    bmi_category,
    bmr,
    tdee,
    target_calories,
    protein_g,
    fat_g,
    carb_g,
    doctor_notes,
    recommendation_text,
    related_product_ids,
    formula_version,
    created_at
  )
  VALUES
    (
      v_client_1,
      NOW() - INTERVAL '5 days',
      34,
      'female',
      158,
      62,
      'light',
      'lose_weight',
      24.8,
      'Thừa cân',
      1277,
      1756,
      1356,
      90,
      38,
      164,
      'Bắt đầu bằng bữa sáng 300-350 kcal, hạn chế đồ uống có đường.',
      'Gợi ý: yến mạch qua đêm với sữa hạt không đường, hạt chia và trái cây ít ngọt. Theo dõi cân nặng mỗi tuần, không cân hằng ngày nếu gây áp lực.',
      ARRAY[v_p_oats, v_p_chia, v_p_milk, v_p_scale]::UUID[],
      'mifflin-st-jeor-v1',
      NOW() - INTERVAL '5 days'
    ),
    (
      v_client_2,
      NOW() - INTERVAL '2 days',
      37,
      'male',
      172,
      76,
      'moderate',
      'improve_health',
      25.7,
      'Béo phì độ I',
      1655,
      2565,
      2565,
      110,
      71,
      371,
      'Duy trì tập 3 buổi mỗi tuần, bổ sung đạm đều trong ngày.',
      'Gợi ý: chuẩn bị hộp meal prep gồm cơm vừa đủ, thịt nạc hoặc đậu phụ, nhiều rau. Có thể dùng protein thực vật khi bữa chính thiếu đạm.',
      ARRAY[v_p_protein, v_p_meal_prep, v_p_oats]::UUID[],
      'mifflin-st-jeor-v1',
      NOW() - INTERVAL '2 days'
    );

  INSERT INTO audit_logs (
    event_type,
    entity_type,
    entity_id,
    actor,
    action,
    description,
    metadata
  )
  VALUES
    (
      'demo_data.reset',
      'system',
      NULL,
      'Seed script',
      'reset_and_seed',
      'Đã reset dữ liệu nghiệp vụ và tạo bộ dữ liệu demo cho SmartLife Hub.',
      jsonb_build_object(
        'products', 8,
        'orders', 3,
        'nutrition_articles', 3,
        'nutrition_clients', 3
      )
    );
END;
$seed$;

COMMIT;

-- Thong ke nhanh sau khi seed.
SELECT 'products' AS table_name, COUNT(*) AS total FROM products
UNION ALL
SELECT 'categories', COUNT(*) FROM categories
UNION ALL
SELECT 'orders', COUNT(*) FROM orders
UNION ALL
SELECT 'order_items', COUNT(*) FROM order_items
UNION ALL
SELECT 'priority_customers', COUNT(*) FROM priority_customers
UNION ALL
SELECT 'nutrition_categories', COUNT(*) FROM nutrition_categories
UNION ALL
SELECT 'nutrition_articles', COUNT(*) FROM nutrition_articles
UNION ALL
SELECT 'nutrition_clients', COUNT(*) FROM nutrition_clients
UNION ALL
SELECT 'nutrition_assessments', COUNT(*) FROM nutrition_assessments
ORDER BY table_name;
