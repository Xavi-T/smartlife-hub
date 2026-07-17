-- ============================================================
-- Seed chiến dịch marketing khai trương SmartLife Hub
-- Chạy file này SAU khi đã chạy database/marketing_campaigns_schema.sql
-- Có thể chỉnh sửa lại chiến dịch trên giao diện Admin sau khi seed.
-- ============================================================

-- 1) Chiến dịch nền: tích điểm thành viên không giới hạn
INSERT INTO marketing_campaigns (
  campaign_name,
  campaign_code,
  campaign_type,
  description,
  is_active,
  is_unlimited_time,
  start_at,
  end_at,
  priority,
  config,
  created_by,
  updated_by
)
VALUES (
  'Tích điểm thành viên SmartLife Hub',
  'SLH_LOYALTY_BASE',
  'points_earn',
  'Chiến dịch tích điểm mặc định cho mọi khách hàng: 1 điểm cho mỗi 1.000đ thanh toán.',
  true,
  true,
  NULL,
  NULL,
  100,
  jsonb_build_object(
    'pointsEarnRatePer1000', 1,
    'pointsCost', 0,
    'voucherType', NULL,
    'voucherValue', 0,
    'maxDiscountAmount', 0,
    'minOrderAmount', 0,
    'expiresInDays', 0,
    'giftName', NULL,
    'giftSku', NULL,
    'giftQuantity', 0,
    'notes', 'Chiến dịch nền nên giữ lâu dài để khách luôn được tích điểm.'
  ),
  'seed:opening-marketing',
  'seed:opening-marketing'
)
ON CONFLICT (campaign_code) DO UPDATE SET
  campaign_name = EXCLUDED.campaign_name,
  campaign_type = EXCLUDED.campaign_type,
  description = EXCLUDED.description,
  is_active = EXCLUDED.is_active,
  is_unlimited_time = EXCLUDED.is_unlimited_time,
  start_at = EXCLUDED.start_at,
  end_at = EXCLUDED.end_at,
  priority = EXCLUDED.priority,
  config = EXCLUDED.config,
  updated_by = EXCLUDED.updated_by;

-- 2) Chiến dịch khai trương: nhân đôi điểm trong 14 ngày tính từ lúc chạy script
INSERT INTO marketing_campaigns (
  campaign_name,
  campaign_code,
  campaign_type,
  description,
  is_active,
  is_unlimited_time,
  start_at,
  end_at,
  priority,
  config,
  created_by,
  updated_by
)
VALUES (
  'Khai trương - Nhân đôi điểm thành viên',
  'SLH_OPENING_DOUBLE_POINTS',
  'points_earn',
  'Ưu đãi khai trương: khách nhận 2 điểm cho mỗi 1.000đ thanh toán trong 14 ngày đầu.',
  true,
  false,
  NOW(),
  NOW() + INTERVAL '14 days',
  1,
  jsonb_build_object(
    'pointsEarnRatePer1000', 2,
    'pointsCost', 0,
    'voucherType', NULL,
    'voucherValue', 0,
    'maxDiscountAmount', 0,
    'minOrderAmount', 0,
    'expiresInDays', 0,
    'giftName', NULL,
    'giftSku', NULL,
    'giftQuantity', 0,
    'notes', 'Chiến dịch có priority cao để ưu tiên hơn chiến dịch tích điểm nền trong giai đoạn khai trương.'
  ),
  'seed:opening-marketing',
  'seed:opening-marketing'
)
ON CONFLICT (campaign_code) DO UPDATE SET
  campaign_name = EXCLUDED.campaign_name,
  campaign_type = EXCLUDED.campaign_type,
  description = EXCLUDED.description,
  is_active = EXCLUDED.is_active,
  is_unlimited_time = EXCLUDED.is_unlimited_time,
  start_at = EXCLUDED.start_at,
  end_at = EXCLUDED.end_at,
  priority = EXCLUDED.priority,
  config = EXCLUDED.config,
  updated_by = EXCLUDED.updated_by;

-- 3) Chiến dịch đổi điểm lấy voucher: 500 điểm đổi voucher 50.000đ
INSERT INTO marketing_campaigns (
  campaign_name,
  campaign_code,
  campaign_type,
  description,
  is_active,
  is_unlimited_time,
  start_at,
  end_at,
  priority,
  config,
  created_by,
  updated_by
)
VALUES (
  'Đổi điểm nhận voucher mua hàng',
  'SLH_REDEEM_500_TO_50K',
  'points_redeem_voucher',
  'Khách dùng 500 điểm để đổi voucher giảm 50.000đ cho đơn hàng từ 300.000đ.',
  true,
  true,
  NULL,
  NULL,
  100,
  jsonb_build_object(
    'pointsEarnRatePer1000', 0,
    'pointsCost', 500,
    'voucherType', 'amount',
    'voucherValue', 50000,
    'maxDiscountAmount', 0,
    'minOrderAmount', 300000,
    'expiresInDays', 30,
    'giftName', NULL,
    'giftSku', NULL,
    'giftQuantity', 0,
    'notes', 'Voucher có hạn 30 ngày kể từ lúc đổi điểm. Không dùng chung với giảm giá thủ công.'
  ),
  'seed:opening-marketing',
  'seed:opening-marketing'
)
ON CONFLICT (campaign_code) DO UPDATE SET
  campaign_name = EXCLUDED.campaign_name,
  campaign_type = EXCLUDED.campaign_type,
  description = EXCLUDED.description,
  is_active = EXCLUDED.is_active,
  is_unlimited_time = EXCLUDED.is_unlimited_time,
  start_at = EXCLUDED.start_at,
  end_at = EXCLUDED.end_at,
  priority = EXCLUDED.priority,
  config = EXCLUDED.config,
  updated_by = EXCLUDED.updated_by;

-- 4) Chiến dịch tặng quà khai trương trong 14 ngày
-- Lưu ý: hiện hệ thống đang quản lý campaign tặng quà ở mức vận hành/admin,
-- chưa tự động thêm quà vào đơn như voucher. Có thể dùng để nhân viên theo dõi và tặng thủ công.
INSERT INTO marketing_campaigns (
  campaign_name,
  campaign_code,
  campaign_type,
  description,
  is_active,
  is_unlimited_time,
  start_at,
  end_at,
  priority,
  config,
  created_by,
  updated_by
)
VALUES (
  'Khai trương - Tặng quà cho đơn đầu tiên',
  'SLH_OPENING_GIFT_FIRST_ORDER',
  'gift',
  'Chiến dịch tặng quà khai trương cho khách mua hàng trong 14 ngày đầu.',
  true,
  false,
  NOW(),
  NOW() + INTERVAL '14 days',
  1,
  jsonb_build_object(
    'pointsEarnRatePer1000', 0,
    'pointsCost', 0,
    'voucherType', NULL,
    'voucherValue', 0,
    'maxDiscountAmount', 0,
    'minOrderAmount', 0,
    'expiresInDays', 0,
    'giftName', 'Quà khai trương SmartLife Hub',
    'giftSku', 'OPENING_GIFT',
    'giftQuantity', 1,
    'notes', 'Có thể đổi tên quà/số lượng trên giao diện Admin cho phù hợp tồn kho thực tế.'
  ),
  'seed:opening-marketing',
  'seed:opening-marketing'
)
ON CONFLICT (campaign_code) DO UPDATE SET
  campaign_name = EXCLUDED.campaign_name,
  campaign_type = EXCLUDED.campaign_type,
  description = EXCLUDED.description,
  is_active = EXCLUDED.is_active,
  is_unlimited_time = EXCLUDED.is_unlimited_time,
  start_at = EXCLUDED.start_at,
  end_at = EXCLUDED.end_at,
  priority = EXCLUDED.priority,
  config = EXCLUDED.config,
  updated_by = EXCLUDED.updated_by;

-- Kiểm tra nhanh các chiến dịch vừa seed
SELECT
  campaign_name,
  campaign_code,
  campaign_type,
  is_active,
  is_unlimited_time,
  start_at,
  end_at,
  priority,
  config
FROM marketing_campaigns
WHERE campaign_code IN (
  'SLH_LOYALTY_BASE',
  'SLH_OPENING_DOUBLE_POINTS',
  'SLH_REDEEM_500_TO_50K',
  'SLH_OPENING_GIFT_FIRST_ORDER'
)
ORDER BY campaign_type, priority, campaign_name;
