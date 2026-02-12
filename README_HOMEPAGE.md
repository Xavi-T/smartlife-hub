# SmartLife Hub - Trang chủ bán hàng

## 🏪 Tính năng đã hoàn thành

### ✅ Trang chủ khách hàng

**Header:**

- Logo và tên cửa hàng "SmartLife Hub"
- Icon giỏ hàng với badge hiển thị số lượng sản phẩm
- Sticky header (luôn hiển thị khi scroll)

**Danh sách sản phẩm:**

- Grid layout responsive (2 cols mobile, 4 cols desktop)
- Card sản phẩm với:
  - Hình ảnh sản phẩm
  - Tên và mô tả
  - Danh mục (badge)
  - Giá bán
  - Nút "Thêm vào giỏ"
  - Badge "Hết hàng" / "Còn X" cho sản phẩm sắp hết

**Giỏ hàng (LocalStorage):**

- Sidebar modal slide từ bên phải
- Hiển thị danh sách sản phẩm trong giỏ
- Tăng/giảm số lượng
- Xóa sản phẩm
- Hiển thị tổng tiền
- Nút "Thanh toán"
- Dữ liệu lưu tự động trong localStorage

**Modal checkout:**

- Form nhập thông tin:
  - Họ tên
  - Số điện thoại
  - Địa chỉ giao hàng
  - Ghi chú (optional)
- Tóm tắt đơn hàng
- Validate form
- Gửi đơn hàng qua Server Action
- Thông báo thành công
- Tự động xóa giỏ hàng sau khi đặt thành công

## 📁 Cấu trúc files

```
app/
├── page.tsx                    # Trang chủ (main)
components/
└── home/
    ├── Header.tsx              # Header với cart badge
    ├── ProductCard.tsx         # Card sản phẩm
    ├── ProductGrid.tsx         # Grid layout
    ├── CartModal.tsx           # Modal giỏ hàng
    └── CheckoutModal.tsx       # Modal thanh toán
hooks/
└── useCart.ts                  # Custom hook quản lý giỏ hàng (localStorage)
```

## 🎨 Mobile-first Design

✅ **Responsive:**

- Grid 2 columns trên mobile
- Grid 4 columns trên desktop
- Touch-friendly buttons (44px minimum)
- Modals toàn màn hình trên mobile

✅ **Performance:**

- Client-side caching với localStorage
- Lazy loading images
- Optimized re-renders

✅ **UX:**

- Loading states
- Error handling
- Success feedback
- Smooth transitions
- Accessible (ARIA labels)

## 🚀 Cách sử dụng

### 1. Setup database

```bash
# Chạy SQL trong Supabase
# File: database/schema.sql + database/create_order_function.sql
```

### 2. Cấu hình environment

```bash
# File: .env.local
NEXT_PUBLIC_SUPABASE_URL=your-url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-key
```

### 3. Chạy development

```bash
npm run dev
# → http://localhost:3000
```

## 💡 Cách hoạt động

### LocalStorage Cart

```typescript
// hooks/useCart.ts
const cart = [
  {
    product: { id, name, price, ... },
    quantity: 2
  }
]

// Lưu tự động khi thay đổi
localStorage.setItem('smartlife-cart', JSON.stringify(cart))

// Load khi mount
const savedCart = localStorage.getItem('smartlife-cart')
```

### Flow đặt hàng

1. **Khách thêm sản phẩm vào giỏ** → Lưu localStorage
2. **Click icon giỏ hàng** → Mở CartModal
3. **Điều chỉnh số lượng** → Cập nhật localStorage
4. **Click "Thanh toán"** → Mở CheckoutModal
5. **Điền form & submit** → Gọi createOrder() Server Action
6. **Thành công** → Xóa giỏ hàng, refresh products

## 🔧 APIs sử dụng

- `GET /api/products` - Lấy danh sách sản phẩm
- `createOrder()` - Server Action tạo đơn hàng (actions/orders.ts)

## 📱 Screenshots Flow

```
┌─────────────────┐
│  Trang chủ      │ ← Grid sản phẩm
│  [Icon giỏ: 3] │
└─────────────────┘
        ↓ Click "Thêm"
┌─────────────────┐
│  Badge: 4       │ ← Số lượng tăng
└─────────────────┘
        ↓ Click icon giỏ
┌─────────────────┐
│  Giỏ hàng      │ ← Sidebar modal
│  - Sản phẩm A  │
│  - Sản phẩm B  │
│  [Thanh toán]  │
└─────────────────┘
        ↓ Click thanh toán
┌─────────────────┐
│  Checkout      │ ← Modal form
│  Tên: ____     │
│  SĐT: ____     │
│  Địa chỉ: ____ │
│  [Xác nhận]    │
└─────────────────┘
        ↓ Submit
┌─────────────────┐
│  ✅ Thành công │
│  Mã: ABC123    │
└─────────────────┘
```

## 🎯 Features nổi bật

✅ **LocalStorage** - Giỏ hàng không mất khi refresh  
✅ **Responsive** - Tối ưu cho mobile  
✅ **Modal UX** - Slide-in animations  
✅ **Real-time badge** - Cập nhật số lượng giỏ hàng  
✅ **Stock validation** - Kiểm tra tồn kho trước khi đặt  
✅ **Auto refresh** - Cập nhật stock sau khi đặt hàng  
✅ **Type-safe** - TypeScript toàn bộ  
✅ **Clean code** - Component hóa rõ ràng

## 🚀 Next steps

- [ ] Toast notifications (react-hot-toast)
- [ ] Search & filter sản phẩm
- [ ] Product detail page
- [ ] Order history cho khách
- [ ] Wishlist
- [ ] Product recommendations
- [ ] Payment integration

## 📞 Navigation

- **Trang chủ:** `/` - Danh sách sản phẩm & giỏ hàng
- **Admin:** `/admin` - Quản lý sản phẩm & thống kê
- **Checkout demo:** `/checkout` - Trang demo đặt hàng (old)
