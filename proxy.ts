import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import {
  canAccessAdminPath,
  getAdminHomePath,
  getRoleFromUser,
} from "@/lib/rbac";

export async function proxy(request: NextRequest) {
  let response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  });

  const isServerActionRequest =
    request.method === "POST" && request.headers.has("next-action");

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );
          response = NextResponse.next({
            request,
          });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Server Action requests expect a specific RSC response format.
  // Redirecting them here can cause client-side response parsing errors.
  if (isServerActionRequest) {
    return response;
  }

  if (request.nextUrl.pathname.startsWith("/admin")) {
    if (!user) {
      const loginUrl = new URL("/login", request.url);
      loginUrl.searchParams.set("redirect", request.nextUrl.pathname);
      return NextResponse.redirect(loginUrl);
    }

    const role = getRoleFromUser(user);
    const pathname = request.nextUrl.pathname;

    if (!canAccessAdminPath(role, pathname)) {
      return NextResponse.redirect(
        new URL(getAdminHomePath(role), request.url),
      );
    }
  }

  if (request.nextUrl.pathname === "/login" && user) {
    const role = getRoleFromUser(user);
    return NextResponse.redirect(new URL(getAdminHomePath(role), request.url));
  }

  return response;
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - api routes (public APIs)
     * - public files
     */
    "/((?!_next/static|_next/image|favicon.ico|api|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
