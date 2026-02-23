import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import { canManageAccounts, getRoleFromUser, normalizeRole } from "@/lib/rbac";

function createServiceRoleClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    return null;
  }

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

async function requireManagerOrAdmin() {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return {
      error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    };
  }

  const role = getRoleFromUser(user);
  if (!canManageAccounts(role)) {
    return {
      error: NextResponse.json({ error: "Forbidden" }, { status: 403 }),
    };
  }

  return { role, userId: user.id };
}

export async function GET() {
  const authResult = await requireManagerOrAdmin();
  if (authResult.error) return authResult.error;

  const serviceClient = createServiceRoleClient();
  if (!serviceClient) {
    return NextResponse.json(
      { error: "Thiếu cấu hình service role" },
      { status: 500 },
    );
  }

  const users: Array<{
    id: string;
    email: string;
    role: "admin" | "manager" | "employee";
    fullName: string;
    createdAt: string;
    lastSignInAt: string | null;
    emailConfirmedAt: string | null;
    isActive: boolean;
  }> = [];

  let page = 1;
  const perPage = 100;

  while (true) {
    const { data, error } = await serviceClient.auth.admin.listUsers({
      page,
      perPage,
    });

    if (error) {
      return NextResponse.json(
        { error: error.message || "Không thể tải danh sách người dùng" },
        { status: 500 },
      );
    }

    const rows = data?.users || [];
    rows.forEach((row) => {
      const role =
        normalizeRole(row.user_metadata?.role) ||
        normalizeRole(row.app_metadata?.role) ||
        "employee";

      users.push({
        id: row.id,
        email: row.email || "",
        role,
        fullName: String(row.user_metadata?.fullName || ""),
        createdAt: row.created_at,
        lastSignInAt: row.last_sign_in_at || null,
        emailConfirmedAt: row.email_confirmed_at || null,
        isActive: !row.banned_until,
      });
    });

    if (rows.length < perPage) break;
    page += 1;

    if (page > 20) break;
  }

  return NextResponse.json({ users, currentUserId: authResult.userId });
}

export async function POST(request: Request) {
  const authResult = await requireManagerOrAdmin();
  if (authResult.error) return authResult.error;

  const serviceClient = createServiceRoleClient();
  if (!serviceClient) {
    return NextResponse.json(
      { error: "Thiếu cấu hình service role" },
      { status: 500 },
    );
  }

  const payload = await request.json().catch(() => null);
  const email = String(payload?.email || "")
    .trim()
    .toLowerCase();
  const password = String(payload?.password || "");
  const fullName = String(payload?.fullName || "").trim();
  const role = normalizeRole(payload?.role);

  if (!email || !password || !fullName || !role) {
    return NextResponse.json(
      { error: "Thiếu thông tin bắt buộc" },
      { status: 400 },
    );
  }

  if (password.length < 8) {
    return NextResponse.json(
      { error: "Mật khẩu phải có ít nhất 8 ký tự" },
      { status: 400 },
    );
  }

  const { data, error } = await serviceClient.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: {
      fullName,
      role,
    },
  });

  if (error) {
    return NextResponse.json(
      { error: error.message || "Không thể tạo tài khoản" },
      { status: 400 },
    );
  }

  return NextResponse.json({
    user: {
      id: data.user.id,
      email: data.user.email || "",
      fullName,
      role,
    },
  });
}

export async function PATCH(request: Request) {
  const authResult = await requireManagerOrAdmin();
  if (authResult.error) return authResult.error;

  const serviceClient = createServiceRoleClient();
  if (!serviceClient) {
    return NextResponse.json(
      { error: "Thiếu cấu hình service role" },
      { status: 500 },
    );
  }

  const payload = await request.json().catch(() => null);
  const userId = String(payload?.userId || "").trim();
  const fullName = String(payload?.fullName || "").trim();
  const role = normalizeRole(payload?.role);

  if (!userId || !fullName || !role) {
    return NextResponse.json(
      { error: "Thiếu thông tin bắt buộc" },
      { status: 400 },
    );
  }

  const { error } = await serviceClient.auth.admin.updateUserById(userId, {
    user_metadata: {
      fullName,
      role,
    },
  });

  if (error) {
    return NextResponse.json(
      { error: error.message || "Không thể cập nhật tài khoản" },
      { status: 400 },
    );
  }

  return NextResponse.json({ success: true });
}

export async function DELETE(request: Request) {
  const authResult = await requireManagerOrAdmin();
  if (authResult.error) return authResult.error;

  const serviceClient = createServiceRoleClient();
  if (!serviceClient) {
    return NextResponse.json(
      { error: "Thiếu cấu hình service role" },
      { status: 500 },
    );
  }

  const url = new URL(request.url);
  const userId = url.searchParams.get("userId")?.trim() || "";

  if (!userId) {
    return NextResponse.json({ error: "Thiếu userId" }, { status: 400 });
  }

  if (userId === authResult.userId) {
    return NextResponse.json(
      { error: "Không thể xóa chính tài khoản hiện tại" },
      { status: 400 },
    );
  }

  const { error } = await serviceClient.auth.admin.deleteUser(userId);
  if (error) {
    return NextResponse.json(
      { error: error.message || "Không thể xóa tài khoản" },
      { status: 400 },
    );
  }

  return NextResponse.json({ success: true });
}
