import type { User } from "@supabase/supabase-js";

export type AppRole = "admin" | "manager" | "employee";

const VALID_ROLES: AppRole[] = ["admin", "manager", "employee"];

const RECOVERY_ADMIN_EMAILS = ["admin@smartlife.com"];

export const EMPLOYEE_ALLOWED_ADMIN_PATHS = [
  "/admin/quick-sales",
  "/admin/orders",
];

export function normalizeRole(value: unknown): AppRole | null {
  if (typeof value !== "string") return null;
  const normalized = value.trim().toLowerCase();
  return VALID_ROLES.includes(normalized as AppRole)
    ? (normalized as AppRole)
    : null;
}

export function getRoleFromUser(
  user?: Pick<User, "email" | "user_metadata" | "app_metadata"> | null,
): AppRole {
  const email = (user?.email || "").trim().toLowerCase();
  if (RECOVERY_ADMIN_EMAILS.includes(email)) {
    return "admin";
  }

  const role =
    normalizeRole(user?.user_metadata?.role) ||
    normalizeRole(user?.app_metadata?.role);
  return role || "admin";
}

export function canManageAccounts(role: AppRole): boolean {
  return role === "admin" || role === "manager";
}

export function isEmployeeAllowedAdminPath(pathname: string): boolean {
  return EMPLOYEE_ALLOWED_ADMIN_PATHS.some(
    (allowedPath) =>
      pathname === allowedPath || pathname.startsWith(`${allowedPath}/`),
  );
}

export function canAccessAdminPath(role: AppRole, pathname: string): boolean {
  if (role === "employee") {
    return isEmployeeAllowedAdminPath(pathname);
  }

  if (pathname.startsWith("/admin/users")) {
    return canManageAccounts(role);
  }

  return true;
}

export function getAdminHomePath(role: AppRole): string {
  if (role === "employee") {
    return "/admin/quick-sales";
  }

  return "/admin";
}
