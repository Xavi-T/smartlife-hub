# Hướng dẫn Quản lý Sản phẩm & Nhập Kho - SmartLife Hub

## 📦 Tổng quan Luồng Admin

### 1. Quản lý Sản phẩm (`/admin/products`)

Trang quản lý sản phẩm đầy đủ với các chức năng:

#### ✅ Chức năng

- **Thêm sản phẩm mới**: Form đầy đủ với validation
- **Sửa sản phẩm**: Cập nhật thông tin, giá, danh mục
- **Xóa sản phẩm**: Soft delete (set `is_active = false`)
- **Tìm kiếm & Lọc**: Theo tên, danh mục, trạng thái
- **Quản lý ảnh**: Link đến trang upload nhiều ảnh

#### 📊 Thống kê

- Tổng số sản phẩm (active/total)
- Giá trị tồn kho
- Sản phẩm sắp hết hàng (< 10)
- Số lượng danh mục

#### ⚠️ Validation

- Tên sản phẩm: bắt buộc, 3-255 ký tự
- Giá bán ≥ Giá vốn
- Giá không được âm
- Tồn kho không được âm
- Danh mục: bắt buộc

#### 🔄 Audit Logging

Mọi thao tác đều được ghi log tự động:

- `product.created`: Tạo sản phẩm mới
- `product.updated`: Cập nhật sản phẩm
- `product.deleted`: Xóa sản phẩm

---

### 2. Quản lý Kho (`/admin/inventory`)

Trang quản lý tồn kho và nhập hàng:

#### ✅ Chức năng

- Xem danh sách tồn kho
- Lọc theo danh mục, tìm kiếm
- Click vào sản phẩm → Mở modal nhập hàng
- Highlight sản phẩm tồn kho thấp (< 10)

#### 📥 Nhập Hàng (Stock Inbound)

**Phương pháp 1: Từ Dashboard (`/admin`)**

- Card "Nhập hàng nhanh"
- Chọn sản phẩm, số lượng, giá vốn
- ⚠️ Không có nhà cung cấp, ghi chú

**Phương pháp 2: Từ Inventory (`/admin/inventory`)** ⭐ **KHUYẾN NGHỊ**

- Click vào sản phẩm → Modal đầy đủ
- Nhập đầy đủ: số lượng, giá vốn, nhà cung cấp, ghi chú
- Preview giá vốn bình quân gia quyền

#### 💰 Tính Giá Vốn Bình Quân Gia Quyền

Công thức:

```
Giá vốn mới = (Tồn cũ × Giá cũ + Tồn mới × Giá mới) / (Tồn cũ + Tồn mới)
```

**Ví dụ:**

- Hiện có: 10 sản phẩm, giá vốn 100,000đ
- Nhập thêm: 5 sản phẩm, giá vốn 120,000đ
- Giá vốn mới: (10×100,000 + 5×120,000) / 15 = **106,667đ**

#### 🔄 Database Trigger

- Tự động cập nhật `stock_quantity`
- Tự động tính và cập nhật `cost_price`
- Lưu lịch sử vào bảng `stock_inbound`

---

### 3. Quản lý Ảnh Sản phẩm (`/admin/products/[id]/media`)

#### ✅ Chức năng

- Upload nhiều ảnh cùng lúc
- Drag & drop để sắp xếp thứ tự
- Set ảnh cover (ảnh đại diện)
- Xóa ảnh
- Preview ảnh trong gallery

#### 📸 Quy trình

1. Vào `/admin/products`
2. Click icon 🖼️ ở cột "Hành động"
3. Upload ảnh (tối đa 10 ảnh)
4. Drag để sắp xếp thứ tự hiển thị
5. Click "Set as Cover" để chọn ảnh đại diện

---

## 🔐 API Endpoints

### Products API (`/api/products`)

**GET** - Lấy danh sách sản phẩm

```
GET /api/products?activeOnly=true
```

**POST** - Tạo sản phẩm mới

```json
POST /api/products
{
  "name": "Tên sản phẩm",
  "description": "Mô tả",
  "price": 500000,
  "cost_price": 300000,
  "stock_quantity": 0,
  "category": "Điện gia dụng",
  "image_url": "https://...",
  "is_active": true
}
```

**PATCH** - Cập nhật sản phẩm

```json
PATCH /api/products
{
  "id": "product-uuid",
  "name": "Tên mới",
  "price": 550000,
  ...
}
```

**DELETE** - Xóa sản phẩm (soft delete)

```
DELETE /api/products?id=product-uuid
```

### Stock Inbound API (`/api/admin/stock-inbound`)

**POST** - Nhập hàng

```json
POST /api/admin/stock-inbound
{
  "productId": "product-uuid",
  "quantityAdded": 10,
  "costPriceAtTime": 320000,
  "supplier": "Công ty ABC",
  "notes": "Lô hàng tháng 3"
}
```

**GET** - Lịch sử nhập hàng

```
GET /api/admin/stock-inbound?productId=xxx&limit=50
```

---

## 🗂️ Database Schema

### Bảng `products`

```sql
- id: UUID (PK)
- name: VARCHAR(255) NOT NULL
- description: TEXT
- price: DECIMAL(12,2) >= cost_price
- cost_price: DECIMAL(12,2) >= 0
- stock_quantity: INTEGER >= 0
- image_url: VARCHAR(500)
- category: VARCHAR(100) NOT NULL
- is_active: BOOLEAN DEFAULT true
- created_at, updated_at: TIMESTAMP
```

### Bảng `stock_inbound`

```sql
- id: UUID (PK)
- product_id: UUID (FK → products)
- quantity_added: INTEGER > 0
- cost_price_at_time: DECIMAL(10,2) >= 0
- supplier: VARCHAR(255)
- notes: TEXT
- created_by: VARCHAR(100)
- created_at: TIMESTAMP
```

### Bảng `product_images`

```sql
- id: UUID (PK)
- product_id: UUID (FK → products)
- image_url: VARCHAR(500) NOT NULL
- display_order: INTEGER DEFAULT 0
- is_cover: BOOLEAN DEFAULT false
- file_size, width, height: INTEGER
```

---

## 🚀 Quy trình Sử dụng

### Kịch bản 1: Thêm sản phẩm mới + Nhập hàng

1. **Tạo sản phẩm** (`/admin/products`)
   - Click "Thêm sản phẩm"
   - Điền thông tin: tên, giá, danh mục
   - Để tồn kho = 0
   - Lưu

2. **Upload ảnh** (optional)
   - Click icon 🖼️ → Vào trang media
   - Upload ảnh sản phẩm
   - Set ảnh cover

3. **Nhập hàng lần đầu** (`/admin/inventory`)
   - Tìm sản phẩm vừa tạo
   - Click vào sản phẩm → Modal nhập hàng
   - Nhập số lượng, giá vốn, nhà cung cấp
   - Xác nhận

### Kịch bản 2: Nhập hàng bổ sung

1. Vào `/admin/inventory`
2. Tìm kiếm hoặc lọc theo danh mục
3. Click vào sản phẩm cần nhập
4. Nhập thông tin lô hàng mới
5. Hệ thống tự động tính giá vốn bình quân

### Kịch bản 3: Cập nhật giá bán

1. Vào `/admin/products`
2. Click icon ✏️ của sản phẩm
3. Sửa giá bán (phải ≥ giá vốn)
4. Lưu → Tự động ghi audit log

### Kịch bản 4: Xem lịch sử nhập hàng

1. Vào `/admin/stock-history`
2. Xem toàn bộ lịch sử nhập hàng
3. Lọc theo sản phẩm nếu cần

---

## ⚡ Tips & Best Practices

### ✅ Nên làm

1. **Luôn nhập giá vốn chính xác** khi nhập hàng
2. **Dùng StockInboundModal từ Inventory** thay vì form nhanh
3. **Upload ảnh chất lượng cao** để khách hàng dễ nhìn
4. **Đặt tên danh mục nhất quán** (VD: "Điện gia dụng", không phải "dien-gia-dung")
5. **Kiểm tra lịch sử nhập hàng** để đối chiếu

### ❌ Không nên

1. **Không chỉnh tồn kho trực tiếp** trong form sửa sản phẩm → Dùng Nhập hàng
2. **Không xóa sản phẩm có đơn hàng** → Database sẽ chặn (RESTRICT)
3. **Không để giá bán < giá vốn** → Validation sẽ báo lỗi
4. **Không nhập số lượng âm** → Database constraint chặn

---

## 🔍 Troubleshooting

### Vấn đề: "Không đủ hàng trong kho"

- **Nguyên nhân**: Trigger kiểm tra tồn kho không đủ khi tạo đơn
- **Giải pháp**: Nhập thêm hàng trước khi tạo đơn

### Vấn đề: "Giá bán phải lớn hơn giá vốn"

- **Nguyên nhân**: Validation kiểm tra margin
- **Giải pháp**: Điều chỉnh giá bán hoặc giá vốn

### Vấn đề: Giá vốn không đúng sau khi nhập hàng

- **Nguyên nhân**: Có thể do nhập sai giá vốn
- **Giải pháp**: Kiểm tra lại lịch sử nhập hàng, tính lại thủ công

---

## 📚 Tech Stack

- **Frontend**: Next.js 16, React 19, TypeScript, Ant Design
- **Backend**: Next.js API Routes, Supabase (PostgreSQL)
- **Database**: PostgreSQL với triggers, functions, RLS
- **Styling**: Tailwind CSS 4
- **Icons**: Lucide React, Ant Design Icons

---

## 🎯 Roadmap

### Đã hoàn thành

- ✅ CRUD sản phẩm đầy đủ
- ✅ Nhập hàng với weighted average cost
- ✅ Quản lý ảnh sản phẩm
- ✅ Audit logging
- ✅ Search & filter

### Sắp tới

- 🔲 Export báo cáo Excel
- 🔲 Barcode scanning
- 🔲 Batch operations
- 🔲 Product variants (size, color)
- 🔲 Low stock alerts (push notification)

---

**Lưu ý**: Document này được tạo tự động. Cập nhật lần cuối: 2026-02-21
