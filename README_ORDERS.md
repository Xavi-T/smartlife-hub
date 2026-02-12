# SmartLife Hub - Order Processing

## 🛒 Server Action: Xử lý đặt hàng với Transaction

### 📁 Files đã tạo:

1. **[database/create_order_function.sql](database/create_order_function.sql)** - PostgreSQL function với transaction
2. **[types/order.ts](types/order.ts)** - TypeScript types cho đơn hàng
3. **[actions/orders.ts](actions/orders.ts)** - Server Actions
4. **[app/checkout/page.tsx](app/checkout/page.tsx)** - Trang demo đặt hàng

## 🔧 Setup

### 1. Chạy SQL Function trong Supabase

Mở **SQL Editor** trong Supabase và chạy file `database/create_order_function.sql`

Function này sẽ:

- ✅ Kiểm tra tồn kho từng sản phẩm
- ✅ Kiểm tra sản phẩm còn hoạt động
- ✅ Tạo order
- ✅ Tạo order_items
- ✅ Cập nhật (trừ) tồn kho
- ✅ **Tất cả trong một transaction - rollback nếu có lỗi**

### 2. Test trang Checkout

```bash
npm run dev
```

Truy cập: `http://localhost:3000/checkout`

## 📋 Server Actions

### 1. `createOrder(request)` - Tạo đơn hàng

**Input:**

```typescript
{
  customer: {
    name: string;
    phone: string;
    address: string;
    notes?: string;
  },
  items: [
    {
      product_id: string;
      quantity: number;
    }
  ]
}
```

**Output:**

```typescript
{
  success: boolean;
  orderId?: string;
  totalAmount?: number;
  message: string;
}
```

**Validation:**

- ✅ Tên khách hàng không rỗng
- ✅ Số điện thoại hợp lệ (≥10 ký tự)
- ✅ Địa chỉ không rỗng
- ✅ Giỏ hàng không trống
- ✅ Số lượng > 0

**Transaction Logic:**

1. Validate input phía client
2. Gọi PostgreSQL function `create_order_transaction`
3. Function thực hiện:
   - Lock rows (FOR UPDATE) để tránh race condition
   - Kiểm tra tồn kho từng sản phẩm
   - Tạo order với status = 'pending'
   - Tạo order_items với giá tại thời điểm mua
   - Cập nhật tồn kho (trừ đi)
4. Return kết quả hoặc rollback nếu lỗi

### 2. `checkStockAvailability(items)` - Kiểm tra tồn kho

Check tồn kho trước khi submit để UX tốt hơn

**Input:**

```typescript
[{ product_id: string, quantity: number }];
```

**Output:**

```typescript
{
  available: boolean;
  message?: string;
}
```

### 3. `getOrderDetails(orderId)` - Lấy chi tiết đơn hàng

Lấy thông tin đơn hàng với nested order_items và products

## 🔒 Transaction Safety

### Race Condition Protection

```sql
SELECT * FROM products
WHERE id = product_id
FOR UPDATE; -- Lock row
```

- Khi user A đang checkout sản phẩm với 5 items còn lại
- User B cũng checkout cùng sản phẩm đó
- Row bị lock bởi user A → user B phải đợi
- User A hoàn thành → tồn kho = 0
- User B kiểm tra → không đủ hàng → rollback

### Rollback khi có lỗi

```sql
EXCEPTION
  WHEN OTHERS THEN
    -- Tự động rollback toàn bộ transaction
    RETURN error_message;
```

Nếu bất kỳ bước nào thất bại:

- ❌ Order không được tạo
- ❌ Order_items không được tạo
- ❌ Tồn kho không bị thay đổi
- ✅ Database giữ nguyên trạng thái ban đầu

## 💡 Cách sử dụng trong Component

```typescript
"use client";

import { createOrder, checkStockAvailability } from "@/actions/orders";

async function handleCheckout() {
  // 1. Check stock trước
  const stockCheck = await checkStockAvailability(cartItems);
  if (!stockCheck.available) {
    alert(stockCheck.message);
    return;
  }

  // 2. Tạo đơn hàng
  const result = await createOrder({
    customer: {
      name: "Nguyễn Văn A",
      phone: "0901234567",
      address: "123 Nguyễn Huệ, Q1, TP.HCM",
      notes: "Giao giờ hành chính",
    },
    items: [
      { product_id: "uuid-1", quantity: 2 },
      { product_id: "uuid-2", quantity: 1 },
    ],
  });

  if (result.success) {
    console.log("Order ID:", result.orderId);
    console.log("Total:", result.totalAmount);
  } else {
    alert(result.message);
  }
}
```

## 🧪 Test Cases

### ✅ Success Case

- Tồn kho đủ
- Thông tin hợp lệ
- → Order tạo thành công, tồn kho giảm

### ❌ Error Cases

**1. Không đủ tồn kho:**

```
"Không đủ hàng trong kho cho sản phẩm: Nồi cơm điện
(Còn: 2, Yêu cầu: 5)"
```

**2. Sản phẩm ngừng bán:**

```
"Sản phẩm đã ngừng bán: Nồi cơm điện"
```

**3. Sản phẩm không tồn tại:**

```
"Sản phẩm không tồn tại: abc-123"
```

**4. Validation lỗi:**

```
"Số điện thoại không hợp lệ"
"Giỏ hàng trống"
```

## 🎯 Ưu điểm

✅ **Transaction an toàn** - Rollback tự động khi lỗi  
✅ **Race condition protected** - Lock rows khi đang xử lý  
✅ **Type-safe** - TypeScript cho tất cả interfaces  
✅ **Validated** - Check ở cả client và server  
✅ **Lưu giá tại thời điểm mua** - Không bị ảnh hưởng khi giá thay đổi  
✅ **Error messages rõ ràng** - Dễ debug và UX tốt

## 🚀 Next Steps

- [ ] Thêm payment integration
- [ ] Email confirmation khi đặt hàng
- [ ] Webhook notifications
- [ ] Order tracking
- [ ] Cancel order với rollback stock
