import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import {
  canAccessAdminApiPath,
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

  const pathname = request.nextUrl.pathname;

  if (pathname.startsWith("/api/admin")) {
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const role = getRoleFromUser(user);
    if (!canAccessAdminApiPath(role, pathname)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
  }

  if (pathname.startsWith("/admin")) {
    if (!user) {
      const loginUrl = new URL("/login", request.url);
      loginUrl.searchParams.set("redirect", pathname);
      return NextResponse.redirect(loginUrl);
    }

    const role = getRoleFromUser(user);

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
    "/admin/:path*",
    "/api/admin/:path*",
    "/login",
  ],
};
