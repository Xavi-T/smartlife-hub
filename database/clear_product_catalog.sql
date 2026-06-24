-- ===========================================
-- SmartLife Hub - Clear Product Catalog
-- ===========================================
-- CANH BAO:
-- Script nay xoa toan bo du lieu san pham cu va cac du lieu phu thuoc truc tiep:
-- - products
-- - categories, product_categories
-- - product_images, product_variants
-- - stock_inbound
-- - orders, order_items (vi order_items khoa ngoai toi products)
--
-- Script KHONG xoa:
-- - auth.users / tai khoan dang nhap Supabase
-- - file vat ly trong Supabase Storage
-- - audit_logs
-- - du lieu module dinh duong clinical/nutrition
--
-- Nen backup database truoc khi chay tren moi truong that.
-- Cach dung: chay file nay truoc, sau do chay seed_products_smartlifehub_sheet13.sql.
-- ===========================================

BEGIN;

DO $clear_product_catalog$
DECLARE
  v_table_name TEXT;
BEGIN
  FOREACH v_table_name IN ARRAY ARRAY[
    'stock_inbound',
    'product_images',
    'product_variants',
    'product_categories',
    'order_items',
    'orders',
    'products',
    'categories'
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
$clear_product_catalog$;

COMMIT;
