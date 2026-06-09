import { NextResponse } from "next/server";
import type { User } from "@supabase/supabase-js";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import { getRoleFromUser, type AppRole } from "@/lib/rbac";

type AdminAuthSuccess = {
  user: User;
  role: AppRole;
};

type AdminAuthFailure = {
  response: NextResponse;
};

export async function requireAdminRole(
  allowedRoles: AppRole[] = ["admin", "manager"],
): Promise<AdminAuthSuccess | AdminAuthFailure> {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return {
      response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    };
  }

  const role = getRoleFromUser(user);
  if (!allowedRoles.includes(role)) {
    return {
      response: NextResponse.json({ error: "Forbidden" }, { status: 403 }),
    };
  }

  return { user, role };
}

export function isAdminAuthFailure(
  result: AdminAuthSuccess | AdminAuthFailure,
): result is AdminAuthFailure {
  return "response" in result;
}
