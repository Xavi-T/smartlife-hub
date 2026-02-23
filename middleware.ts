import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import {
  canAccessAdminPath,
  getAdminHomePath,
  getRoleFromUser,
} from "@/lib/rbac";

export async function middleware(request: NextRequest) {
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
          cookiesToSet.forEach(({ name, value, options }) =>
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

  // Refresh session if expired
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Server Action requests expect a specific RSC response format.
  // Redirecting them in middleware can cause client-side
  // "An unexpected response was received from the server" errors.
  if (isServerActionRequest) {
    return response;
  }

  // Check if accessing admin routes
  if (request.nextUrl.pathname.startsWith("/admin")) {
    // If not authenticated, redirect to login
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

  // If accessing login page while authenticated, redirect to admin
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
