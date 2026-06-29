-- ============================================================
-- Safe category management for production data
-- ============================================================
-- Run this file once in Supabase SQL Editor before deploying the UI.
-- All write functions are restricted to service_role and are called
-- only by authenticated admin API routes.

CREATE OR REPLACE FUNCTION generate_unique_category_slug(
  p_slug_base TEXT,
  p_excluded_ids UUID[] DEFAULT ARRAY[]::UUID[]
)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_base TEXT;
  v_candidate TEXT;
  v_suffix INTEGER := 2;
BEGIN
  -- Serialize slug allocation so concurrent admin requests cannot pick the
  -- same candidate between the existence check and the write.
  PERFORM PG_ADVISORY_XACT_LOCK(HASHTEXT('category-slug-generator'));

  v_base := LOWER(BTRIM(COALESCE(p_slug_base, '')));
  v_base := REGEXP_REPLACE(v_base, '[^a-z0-9]+', '-', 'g');
  v_base := REGEXP_REPLACE(v_base, '(^-+|-+$)', '', 'g');

  IF v_base = '' THEN
    v_base := 'danh-muc';
  END IF;

  v_candidate := v_base;

  WHILE EXISTS (
    SELECT 1
    FROM categories
    WHERE slug = v_candidate
      AND NOT (id = ANY(COALESCE(p_excluded_ids, ARRAY[]::UUID[])))
  ) LOOP
    v_candidate := v_base || '-' || v_suffix;
    v_suffix := v_suffix + 1;
  END LOOP;

  RETURN v_candidate;
END;
$$;

CREATE OR REPLACE FUNCTION save_product_category(
  p_category_id UUID,
  p_name TEXT,
  p_slug_base TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_name TEXT;
  v_old_name TEXT;
  v_slug TEXT;
  v_category categories%ROWTYPE;
  v_updated_products INTEGER := 0;
BEGIN
  v_name := BTRIM(COALESCE(p_name, ''));

  IF v_name = '' THEN
    RAISE EXCEPTION 'Tên danh mục là bắt buộc';
  END IF;

  IF LENGTH(v_name) > 100 THEN
    RAISE EXCEPTION 'Tên danh mục tối đa 100 ký tự';
  END IF;

  IF p_category_id IS NULL THEN
    v_slug := generate_unique_category_slug(p_slug_base);

    INSERT INTO categories (name, slug, is_active)
    VALUES (v_name, v_slug, true)
    RETURNING * INTO v_category;
  ELSE
    SELECT name
    INTO v_old_name
    FROM categories
    WHERE id = p_category_id
    FOR UPDATE;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Không tìm thấy danh mục';
    END IF;

    v_slug := generate_unique_category_slug(
      p_slug_base,
      ARRAY[p_category_id]
    );

    UPDATE categories
    SET
      name = v_name,
      slug = v_slug,
      updated_at = NOW()
    WHERE id = p_category_id
    RETURNING * INTO v_category;

    -- Keep the legacy primary category field in sync for every current
    -- product that still stores the old category name.
    UPDATE products
    SET
      category = v_name,
      updated_at = NOW()
    WHERE LOWER(BTRIM(category)) = LOWER(BTRIM(v_old_name));

    GET DIAGNOSTICS v_updated_products = ROW_COUNT;
  END IF;

  RETURN JSONB_BUILD_OBJECT(
    'category', TO_JSONB(v_category),
    'updated_products', v_updated_products
  );
END;
$$;

CREATE OR REPLACE FUNCTION merge_product_categories(
  p_category_ids UUID[],
  p_name TEXT,
  p_slug_base TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_category_ids UUID[];
  v_name TEXT;
  v_slug TEXT;
  v_target_id UUID;
  v_source_names TEXT[];
  v_existing_count INTEGER;
  v_affected_products INTEGER := 0;
  v_legacy_products INTEGER := 0;
  v_deleted_categories INTEGER := 0;
  v_category categories%ROWTYPE;
BEGIN
  SELECT ARRAY_AGG(DISTINCT source_id)
  INTO v_category_ids
  FROM UNNEST(COALESCE(p_category_ids, ARRAY[]::UUID[])) AS source_id;

  IF COALESCE(CARDINALITY(v_category_ids), 0) < 2 THEN
    RAISE EXCEPTION 'Cần chọn ít nhất 2 danh mục để gộp';
  END IF;

  v_name := BTRIM(COALESCE(p_name, ''));
  IF v_name = '' THEN
    RAISE EXCEPTION 'Tên danh mục sau khi gộp là bắt buộc';
  END IF;

  IF LENGTH(v_name) > 100 THEN
    RAISE EXCEPTION 'Tên danh mục tối đa 100 ký tự';
  END IF;

  PERFORM id
  FROM categories
  WHERE id = ANY(v_category_ids)
  ORDER BY id
  FOR UPDATE;

  SELECT COUNT(*), ARRAY_AGG(name)
  INTO v_existing_count, v_source_names
  FROM categories
  WHERE id = ANY(v_category_ids);

  IF v_existing_count <> CARDINALITY(v_category_ids) THEN
    RAISE EXCEPTION 'Một hoặc nhiều danh mục không còn tồn tại';
  END IF;

  -- Prefer the source that already owns the desired slug; otherwise retain
  -- the oldest source ID as the destination. This keeps foreign keys stable.
  SELECT id
  INTO v_target_id
  FROM categories
  WHERE id = ANY(v_category_ids)
  ORDER BY
    CASE WHEN slug = p_slug_base THEN 0 ELSE 1 END,
    created_at,
    id
  LIMIT 1;

  v_slug := generate_unique_category_slug(
    p_slug_base,
    ARRAY[v_target_id]
  );

  SELECT COUNT(DISTINCT product_id)
  INTO v_affected_products
  FROM product_categories
  WHERE category_id = ANY(v_category_ids);

  INSERT INTO product_categories (product_id, category_id)
  SELECT DISTINCT product_id, v_target_id
  FROM product_categories
  WHERE category_id = ANY(v_category_ids)
  ON CONFLICT (product_id, category_id) DO NOTHING;

  UPDATE products AS product
  SET
    category = v_name,
    updated_at = NOW()
  WHERE EXISTS (
    SELECT 1
    FROM UNNEST(v_source_names) AS source_name
    WHERE LOWER(BTRIM(product.category)) = LOWER(BTRIM(source_name))
  );

  GET DIAGNOSTICS v_legacy_products = ROW_COUNT;

  DELETE FROM categories
  WHERE id = ANY(v_category_ids)
    AND id <> v_target_id;

  GET DIAGNOSTICS v_deleted_categories = ROW_COUNT;

  UPDATE categories
  SET
    name = v_name,
    slug = v_slug,
    is_active = true,
    updated_at = NOW()
  WHERE id = v_target_id
  RETURNING * INTO v_category;

  RETURN JSONB_BUILD_OBJECT(
    'category', TO_JSONB(v_category),
    'merged_categories', v_deleted_categories + 1,
    'updated_products', GREATEST(v_affected_products, v_legacy_products)
  );
END;
$$;

CREATE OR REPLACE FUNCTION delete_product_categories(
  p_category_ids UUID[]
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_category_ids UUID[];
  v_used_names TEXT;
  v_deleted_categories INTEGER := 0;
BEGIN
  SELECT ARRAY_AGG(DISTINCT source_id)
  INTO v_category_ids
  FROM UNNEST(COALESCE(p_category_ids, ARRAY[]::UUID[])) AS source_id;

  IF COALESCE(CARDINALITY(v_category_ids), 0) = 0 THEN
    RAISE EXCEPTION 'Chưa chọn danh mục cần xóa';
  END IF;

  PERFORM id
  FROM categories
  WHERE id = ANY(v_category_ids)
  ORDER BY id
  FOR UPDATE;

  SELECT STRING_AGG(DISTINCT category.name, ', ' ORDER BY category.name)
  INTO v_used_names
  FROM categories AS category
  JOIN product_categories AS relation
    ON relation.category_id = category.id
  WHERE category.id = ANY(v_category_ids);

  IF v_used_names IS NOT NULL THEN
    RAISE EXCEPTION
      'Không thể xóa danh mục đang được sản phẩm sử dụng: %',
      v_used_names;
  END IF;

  DELETE FROM categories
  WHERE id = ANY(v_category_ids);

  GET DIAGNOSTICS v_deleted_categories = ROW_COUNT;

  RETURN JSONB_BUILD_OBJECT('deleted_categories', v_deleted_categories);
END;
$$;

REVOKE ALL ON FUNCTION generate_unique_category_slug(TEXT, UUID[])
FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION save_product_category(UUID, TEXT, TEXT)
FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION merge_product_categories(UUID[], TEXT, TEXT)
FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION delete_product_categories(UUID[])
FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION generate_unique_category_slug(TEXT, UUID[])
TO service_role;
GRANT EXECUTE ON FUNCTION save_product_category(UUID, TEXT, TEXT)
TO service_role;
GRANT EXECUTE ON FUNCTION merge_product_categories(UUID[], TEXT, TEXT)
TO service_role;
GRANT EXECUTE ON FUNCTION delete_product_categories(UUID[])
TO service_role;
