import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import { canManageAccounts, getRoleFromUser } from "@/lib/rbac";

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

function generateTemporaryPassword(length = 12): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789@#$";
  return Array.from(
    { length },
    () => chars[Math.floor(Math.random() * chars.length)],
  ).join("");
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

  return { role };
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
  const userId = String(payload?.userId || "").trim();

  if (!userId) {
    return NextResponse.json({ error: "Thiếu userId" }, { status: 400 });
  }

  const temporaryPassword = generateTemporaryPassword();

  const { error } = await serviceClient.auth.admin.updateUserById(userId, {
    password: temporaryPassword,
  });

  if (error) {
    return NextResponse.json(
      { error: error.message || "Không thể reset mật khẩu" },
      { status: 400 },
    );
  }

  return NextResponse.json({
    temporaryPassword,
    message: "Đã reset mật khẩu thành công",
  });
}
