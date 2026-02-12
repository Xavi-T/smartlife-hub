# SmartLife Hub - Admin Dashboard

## 📋 Hướng dẫn Setup

### 1. Cấu hình Supabase

1. Tạo project trên [Supabase](https://supabase.com)
2. Chạy SQL script trong file `database/schema.sql` tại **SQL Editor**
3. Copy URL và Anon Key từ **Project Settings > API**
4. Tạo file `.env.local` từ `.env.local.example`:

```bash
cp .env.local.example .env.local
```

5. Cập nhật thông tin Supabase trong `.env.local`:

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here
```

### 2. Cài đặt và chạy

```bash
# Đã cài đặt dependencies
npm install

# Chạy development server
npm run dev
```

### 3. Truy cập Admin Dashboard

Mở browser tại: `http://localhost:3000/admin`

## 🎯 Tính năng Admin Dashboard

### ✅ Thống kê tổng quan (4 cards)

- **Tổng doanh thu**: Tổng tiền từ các đơn hàng đã giao
- **Tổng lợi nhuận**: Tính từ (Giá bán - Giá vốn) × Số lượng bán
- **Đơn hàng tháng này**: Số đơn hàng trong tháng hiện tại
- **Sản phẩm sắp hết**: Số sản phẩm có tồn kho < 5

### 📦 Bảng danh sách sản phẩm

- Hiển thị đầy đủ thông tin: Tên, ảnh, danh mục, giá bán, giá vốn, tồn kho
- **Highlight đỏ** cho sản phẩm có tồn kho < 5
- Icon cảnh báo ⚠️ cho sản phẩm sắp hết
- Sắp xếp theo tồn kho (thấp nhất lên trước)

### 📥 Form nhập hàng nhanh

- Dropdown chọn sản phẩm (hiển thị tồn kho hiện tại)
- Nhập số lượng cần thêm vào kho
- Tự động cập nhật và refresh dữ liệu
- Thông báo thành công/lỗi

### 🔔 Cảnh báo

- Alert box màu đỏ khi có sản phẩm tồn kho thấp
- Nút "Làm mới" để cập nhật dữ liệu realtime

## 🎨 Công nghệ sử dụng

- **Next.js 16** (App Router)
- **React 19**
- **TypeScript**
- **Tailwind CSS 4**
- **Supabase** (PostgreSQL + RLS)
- **Lucide React** (Icons)

## 📁 Cấu trúc code

```
app/
├── admin/
│   └── page.tsx              # Trang Admin Dashboard
├── api/
│   ├── products/
│   │   ├── route.ts          # GET products
│   │   └── stock/route.ts    # PATCH update stock
│   └── stats/route.ts        # GET statistics
components/
└── admin/
    ├── StatsCard.tsx         # Component card thống kê
    ├── ProductTable.tsx      # Bảng sản phẩm
    └── QuickStockForm.tsx    # Form nhập hàng
lib/
├── supabase.ts              # Supabase client
└── utils.ts                 # Format currency, numbers
types/
└── database.ts              # TypeScript types
```

## 🚀 Next Steps

1. Thêm tính năng thêm/sửa/xóa sản phẩm
2. Tạo trang quản lý đơn hàng
3. Thêm charts/graphs cho báo cáo
4. Thêm authentication cho admin
5. Export báo cáo Excel/PDF
