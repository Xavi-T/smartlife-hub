import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";

const STORAGE_BUCKET = "product-images";

function getErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message) {
    return error.message;
  }
  return fallback;
}

async function createApiSupabaseClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, options);
          });
        },
      },
    },
  );
}

function createStorageAdminClient() {
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!serviceRoleKey) {
    throw new Error("Thiếu SUPABASE_SERVICE_ROLE_KEY để xóa media");
  }

  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

function normalizePurpose(value: string | null): string {
  const supported = new Set(["site_logo", "site_favicon", "homepage_banner"]);

  if (!value) return "site_logo";
  return supported.has(value) ? value : "site_logo";
}

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await context.params;
    const authClient = await createApiSupabaseClient();
    const {
      data: { user },
    } = await authClient.auth.getUser();

    if (!user) {
      return NextResponse.json(
        { error: "Bạn chưa đăng nhập" },
        { status: 401 },
      );
    }

    const body = await request.json();
    const updates = {
      media_key:
        typeof body.mediaKey === "string" && body.mediaKey.trim()
          ? body.mediaKey.trim()
          : null,
      purpose: normalizePurpose(
        typeof body.purpose === "string" ? body.purpose : null,
      ),
      alt_text:
        typeof body.altText === "string" && body.altText.trim()
          ? body.altText.trim()
          : null,
    };

    const dbClient = authClient as any;
    const { data, error } = await dbClient
      .from("site_media_assets")
      .update(updates)
      .eq("id", id)
      .select(
        "id, media_key, purpose, alt_text, file_name, mime_type, file_size, image_url, storage_path, width, height, created_at",
      )
      .single();

    if (error) throw error;

    return NextResponse.json({ success: true, media: data });
  } catch (error: unknown) {
    console.error("Error updating media:", error);
    return NextResponse.json(
      { error: getErrorMessage(error, "Không thể cập nhật media") },
      { status: 500 },
    );
  }
}

export async function DELETE(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await context.params;
    const authClient = await createApiSupabaseClient();
    const {
      data: { user },
    } = await authClient.auth.getUser();

    if (!user) {
      return NextResponse.json(
        { error: "Bạn chưa đăng nhập" },
        { status: 401 },
      );
    }

    const dbClient = authClient as any;
    const { data: existing, error: fetchError } = await dbClient
      .from("site_media_assets")
      .select("id, storage_path")
      .eq("id", id)
      .single();

    if (fetchError || !existing) {
      return NextResponse.json(
        { error: "Không tìm thấy media" },
        { status: 404 },
      );
    }

    const storageClient = createStorageAdminClient();
    const { error: removeError } = await storageClient.storage
      .from(STORAGE_BUCKET)
      .remove([existing.storage_path]);

    if (removeError) {
      console.error("Error removing media from storage:", removeError);
    }

    const { error: deleteError } = await dbClient
      .from("site_media_assets")
      .delete()
      .eq("id", id);

    if (deleteError) throw deleteError;

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    console.error("Error deleting media:", error);
    return NextResponse.json(
      { error: getErrorMessage(error, "Không thể xóa media") },
      { status: 500 },
    );
  }
}
