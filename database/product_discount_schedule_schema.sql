-- Thêm khung thời gian hiệu lực giảm giá cho sản phẩm
ALTER TABLE products
  ADD COLUMN IF NOT EXISTS discount_start_at TIMESTAMP WITH TIME ZONE;

ALTER TABLE products
  ADD COLUMN IF NOT EXISTS discount_end_at TIMESTAMP WITH TIME ZONE;

-- Ràng buộc: nếu có đủ 2 mốc thời gian thì thời điểm kết thúc phải sau thời điểm bắt đầu
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'products_discount_schedule_valid'
  ) THEN
    ALTER TABLE products
      ADD CONSTRAINT products_discount_schedule_valid
      CHECK (
        discount_start_at IS NULL
        OR discount_end_at IS NULL
        OR discount_end_at > discount_start_at
      );
  END IF;
END $$;
