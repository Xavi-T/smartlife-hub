import type { User } from "@supabase/supabase-js";

export type AppRole = "admin" | "manager" | "doctor" | "employee";

const VALID_ROLES: AppRole[] = ["admin", "manager", "doctor", "employee"];

const RECOVERY_ADMIN_EMAILS = ["admin@smartlife.com"];

export const EMPLOYEE_ALLOWED_ADMIN_PATHS = [
  "/admin/quick-sales",
  "/admin/orders",
];

export const DOCTOR_ALLOWED_ADMIN_PATHS = [
  "/admin/nutrition",
  "/admin/media",
];

export const EMPLOYEE_ALLOWED_ADMIN_API_PATHS = ["/api/admin/orders"];

export const DOCTOR_ALLOWED_ADMIN_API_PATHS = [
  "/api/admin/nutrition",
  "/api/admin/media",
];

function pathnameMatchesAny(pathname: string, allowedPaths: string[]): boolean {
  return allowedPaths.some(
    (allowedPath) =>
      pathname === allowedPath || pathname.startsWith(`${allowedPath}/`),
  );
}

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

  // New accounts store authorization roles in app_metadata. Keep the
  // user_metadata fallback so existing production accounts retain their role.
  const role =
    normalizeRole(user?.app_metadata?.role) ||
    normalizeRole(user?.user_metadata?.role);
  return role || "employee";
}

export function canManageAccounts(role: AppRole): boolean {
  return role === "admin" || role === "manager";
}

export function isEmployeeAllowedAdminPath(pathname: string): boolean {
  return pathnameMatchesAny(pathname, EMPLOYEE_ALLOWED_ADMIN_PATHS);
}

export function canAccessAdminPath(role: AppRole, pathname: string): boolean {
  if (role === "employee") {
    return isEmployeeAllowedAdminPath(pathname);
  }

  if (role === "doctor") {
    return pathnameMatchesAny(pathname, DOCTOR_ALLOWED_ADMIN_PATHS);
  }

  if (pathname.startsWith("/admin/users")) {
    return canManageAccounts(role);
  }

  return true;
}

export function canAccessAdminApiPath(
  role: AppRole,
  pathname: string,
): boolean {
  if (role === "employee") {
    return pathnameMatchesAny(pathname, EMPLOYEE_ALLOWED_ADMIN_API_PATHS);
  }

  if (role === "doctor") {
    return pathnameMatchesAny(pathname, DOCTOR_ALLOWED_ADMIN_API_PATHS);
  }

  return role === "admin" || role === "manager";
}

export function getAdminHomePath(role: AppRole): string {
  if (role === "employee") {
    return "/admin/quick-sales";
  }

  if (role === "doctor") {
    return "/admin/nutrition/articles";
  }

  return "/admin";
}
