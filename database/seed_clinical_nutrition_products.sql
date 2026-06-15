-- ===========================================
-- Seed danh mục sản phẩm tính khẩu phần lâm sàng
-- Nguồn: bảng Excel "Danh mục sản phẩm dinh dưỡng - cấu hình thông số"
-- Quy ước: P/L/G tính theo g/100 đơn vị, E tính theo kcal/100 đơn vị
-- ===========================================

INSERT INTO clinical_nutrition_products (
  sort_order,
  name,
  unit,
  protein_per100,
  lipid_per100,
  glucose_per100,
  energy_per100,
  note,
  is_active
)
SELECT
  seed.sort_order,
  seed.name,
  seed.unit,
  seed.protein_per100,
  seed.lipid_per100,
  seed.glucose_per100,
  seed.energy_per100,
  seed.note,
  true
FROM (
  VALUES
    (1, 'MG-tan', 'ml', 2.35, 3.54, 6.77, 68.32, NULL),
    (2, 'Compilipid Peri injection', 'ml', 2.34, 3.54, 6.76, 68.26, NULL),
    (3, 'Combilipid MCT Peri injection', 'ml', 3.20, 4.00, 6.40, 74.40, NULL),
    (4, 'Smoflipid 20%', 'ml', 0, 20, 0, 180, NULL),
    (5, 'Glucose 10%/ Dextrose 10%', 'ml', 0, 0, 10, 40, NULL),
    (6, 'Glucose 5%', 'ml', 0, 0, 5, 20, NULL),
    (7, 'Amiparen 10%', 'ml', 10, 0, 0, 40, NULL),
    (8, 'Aminoplasma 10%', 'ml', 10, 0, 0, 40, NULL),
    (9, 'Fomeal Basic soup 250ml', 'ml', 3.8, 3.32, 13.72, 100, NULL),
    (10, 'Fomeal Peptides 250ml', 'ml', 5, 3.12, 13, 100, NULL),
    (11, 'Leisure cerna', 'ml', 5, 3.12, 13, 100, NULL),
    (12, 'Leisure low iod', 'ml', 3.8, 3.32, 13.72, 100, NULL),
    (13, 'Leisure Liver', 'ml', 5.75, 2.5, 26, 150, NULL),
    (14, 'Leisure Kidney 1', 'ml', 2.8, 3.95, 17.85, 120, NULL),
    (15, 'Leisure Kidney 2', 'ml', 7.48, 4.4, 20.08, 150, NULL),
    (16, 'Leisure PreOp 200ml', 'ml', 0, 0, 12.5, 50, NULL),
    (17, 'Leisure Omega x2', 'ml', 8.25, 4.65, 18.75, 150, NULL),
    (18, 'Fomeal Omega 250ml', 'ml', 3.8, 3.32, 13.72, 100, NULL),
    (19, 'Ensure Gold vani bột', 'g', 17.33, 14, 56.21, 432, 'Để pha 230 ml, cho 185 ml nước 6 muỗng gạt ngang (60,6 g)'),
    (20, 'Ensure Gold vani bột ít ngọt', 'g', 17.33, 14, 56.21, 432, NULL),
    (21, 'Ensure Gold vani pha sẵn 237ml', 'ml', 4.641350211, 3.797468354, 15.61181435, 113.9240506, NULL),
    (22, 'Ensure Original pha sẵn 237ml', 'ml', 3.797468354, 2.53164557, 17.29957806, 105.4852321, NULL),
    (23, 'Glucerna bột', 'g', 19.5, 16.7, 50.11, 437, NULL),
    (24, 'Glucerna pha sẵn 220ml', 'ml', 4.618181818, 3.740909091, 10.03181818, 96.36363636, NULL),
    (25, 'ProSure bột', 'g', 21.29, 8.19, 57.66, 402, NULL),
    (26, 'ProSure pha sẵn 220ml', 'ml', 6.65, 2.56, 18.33, 127, NULL),
    (27, 'Peptamen bột', 'g', 23.5, 18, 52.5, 466, NULL),
    (28, 'Nepro 1', 'g', 10.5, 15.1, 66.4, 443.5, NULL),
    (29, 'Nepro 1 Gold', 'g', 10.5, 17.5, 60, 415.5, NULL),
    (30, 'Nepro 2', 'g', 20, 9.8, 62.7, 419, NULL),
    (31, 'Nepro 2 Gold', 'g', 20, 16, 52, 415, NULL),
    (32, 'Fohepta', 'g', 15.5, 9.2, 67.3, 414, NULL),
    (33, 'Morihepamin', 'ml', 7.585, 0, 0, 30.34, NULL),
    (34, 'Calo sure bột', 'g', 16.7, 15, 62, 450, NULL),
    (35, 'Calo sure gold ít đường bột', 'g', 19, 19, 53.6, 461.4, NULL),
    (36, 'Soup VM', 'ml', 5.51, 2.94, 12.88, 100, NULL),
    (37, 'Protimedia 40ml', 'ml', 20, 0, 0, 80, NULL)
) AS seed(
  sort_order,
  name,
  unit,
  protein_per100,
  lipid_per100,
  glucose_per100,
  energy_per100,
  note
)
WHERE NOT EXISTS (
  SELECT 1
  FROM clinical_nutrition_products existing
  WHERE LOWER(TRIM(existing.name)) = LOWER(TRIM(seed.name))
    AND existing.unit = seed.unit
);
