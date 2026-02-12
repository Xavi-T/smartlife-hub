# Hướng dẫn Setup Xác thực Admin

## 1. Cấu hình Supabase Authentication

### Bước 1: Tạo Admin User trong Supabase Dashboard

Truy cập **Supabase Dashboard** → **Authentication** → **Users** → **Add user**

Hoặc sử dụng SQL trong **SQL Editor**:

```sql
-- Tạo admin user với email và password
-- Lưu ý: Thay đổi email và password theo ý bạn
INSERT INTO auth.users (
  instance_id,
  id,
  aud,
  role,
  email,
  encrypted_password,
  email_confirmed_at,
  created_at,
  updated_at,
  confirmation_token,
  email_change,
  email_change_token_new,
  recovery_token
) VALUES (
  '00000000-0000-0000-0000-000000000000',
  gen_random_uuid(),
  'authenticated',
  'authenticated',
  'admin@smartlife.com',
  crypt('Admin@123456', gen_salt('bf')),
  NOW(),
  NOW(),
  NOW(),
  '',
  '',
  '',
  ''
);

-- Hoặc sử dụng Supabase Auth Admin API (khuyến nghị)
-- Trong Supabase Dashboard → Authentication → Users → Add User
-- Email: admin@smartlife.com
-- Password: Admin@123456
```

### Bước 2: Kiểm tra Email Settings (Optional)

Nếu bạn muốn tắt email confirmation trong môi trường development:

1. Vào **Supabase Dashboard** → **Authentication** → **Settings**
2. Tắt "Enable email confirmations"
3. Hoặc trong SQL:

```sql
-- Confirm email ngay lập tức cho user vừa tạo
UPDATE auth.users
SET email_confirmed_at = NOW()
WHERE email = 'admin@smartlife.com';
```

## 2. Thông tin đăng nhập mặc định

**URL Login:** `http://localhost:3000/login`

**Tài khoản mặc định:**

- Email: `admin@smartlife.com`
- Password: `Admin@123456`

## 3. Cách hoạt động

### Middleware (`middleware.ts`)

- Kiểm tra session cho mọi request đến `/admin/*`
- Nếu chưa đăng nhập → redirect về `/login`
- Nếu đã đăng nhập và truy cập `/login` → redirect về `/admin`
- Refresh session tự động nếu token hết hạn

### Server Actions (`actions/auth.ts`)

- `login()`: Xác thực với Supabase Auth
- `logout()`: Xóa session và redirect về login
- `getCurrentUser()`: Lấy thông tin user hiện tại

### Cookie Management

- Sử dụng `@supabase/ssr` để quản lý cookies
- Session được lưu trong cookies HTTP-only
- Tự động refresh khi hết hạn

## 4. Security Notes

### Best Practices

1. **Thay đổi password mặc định** sau lần đăng nhập đầu tiên
2. Sử dụng password mạnh (ít nhất 8 ký tự, bao gồm chữ hoa, chữ thường, số, ký tự đặc biệt)
3. Enable MFA (Multi-Factor Authentication) trong production
4. Không commit `.env.local` vào Git

### Row Level Security (RLS)

Các bảng dữ liệu đã được bảo vệ bằng RLS policies trong `database/schema.sql`:

- Chỉ authenticated users mới có thể truy cập admin APIs
- Public users chỉ có thể tạo orders (không xem/sửa/xóa)

## 5. Troubleshooting

### Không thể đăng nhập?

1. Kiểm tra Supabase URL và ANON KEY trong `.env.local`
2. Verify user đã được tạo trong Supabase Dashboard
3. Kiểm tra email đã được confirmed chưa
4. Xem logs trong Supabase Dashboard → Logs

### Session bị mất khi reload?

1. Kiểm tra cookies có được set đúng không (DevTools → Application → Cookies)
2. Verify middleware đang chạy (check console logs)
3. Clear cookies và đăng nhập lại

### Middleware không hoạt động?

1. Verify `middleware.ts` ở root folder của project
2. Check matcher config trong middleware
3. Restart dev server: `npm run dev`

## 6. Testing

```bash
# Khởi động dev server
npm run dev

# Truy cập trang admin (sẽ redirect về login)
http://localhost:3000/admin

# Đăng nhập với tài khoản admin
# Sau khi đăng nhập thành công, sẽ redirect về /admin

# Test logout
# Click nút "Đăng xuất" trong sidebar
```

## 7. Production Deployment

### Environment Variables

Đảm bảo các biến môi trường sau được set trong production:

```env
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
```

### Additional Security

1. Enable HTTPS
2. Set secure cookie flags
3. Enable CORS restrictions
4. Add rate limiting
5. Enable MFA for admin accounts
6. Regular security audits

## 8. Thêm Admin Users mới

### Cách 1: Supabase Dashboard

1. Vào **Authentication** → **Users**
2. Click **Add User**
3. Nhập email và password
4. User mới có thể đăng nhập ngay

### Cách 2: API Endpoint (Tùy chọn)

Bạn có thể tạo API endpoint `/api/admin/users/create` để tạo user mới:

```typescript
// app/api/admin/users/create/route.ts
import { createServerSupabaseClient } from "@/lib/supabase-server";

export async function POST(request: Request) {
  const supabase = await createServerSupabaseClient();

  // Verify current user is admin
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { email, password } = await request.json();

  // Create new user using Supabase Auth Admin API
  // Note: Requires service_role key for admin operations
  // This is just an example - implement proper validation

  return Response.json({ success: true });
}
```

---

**Lưu ý:** Hệ thống này sử dụng Supabase Auth built-in, đơn giản và bảo mật. Không cần tạo bảng users riêng vì Supabase đã quản lý sẵn trong `auth.users`.
