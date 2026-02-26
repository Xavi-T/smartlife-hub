import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";

const STORAGE_BUCKET = "product-images";
const STORAGE_PREFIX = "site-media";
const MAX_IMAGE_SIZE = 12 * 1024 * 1024;
const MAX_VIDEO_SIZE = 100 * 1024 * 1024;
const SINGLE_MEDIA_PURPOSES = new Set([
  "site_logo",
  "site_favicon",
  "bank_qrcode",
]);
type SiteMediaSearchRow = {
  file_name?: string | null;
  media_key?: string | null;
  alt_text?: string | null;
};
type SiteMediaRefRow = {
  id: string;
  storage_path: string | null;
};

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
    throw new Error("Thiếu SUPABASE_SERVICE_ROLE_KEY để upload media");
  }

  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

function normalizePurpose(value: string | null): string {
  const supported = new Set([
    "site_logo",
    "site_favicon",
    "homepage_banner",
    "bank_qrcode",
  ]);

  if (!value) return "site_logo";
  return supported.has(value) ? value : "site_logo";
}

export async function GET(request: NextRequest) {
  try {
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

    const { searchParams } = new URL(request.url);
    const purpose = searchParams.get("purpose");
    const keyword = (searchParams.get("q") || "").trim();

    let query = authClient
      .from("site_media_assets")
      .select(
        "id, media_key, purpose, alt_text, file_name, mime_type, file_size, image_url, storage_path, width, height, display_order, created_at",
      );

    if (purpose && purpose !== "all") {
      query = query.eq("purpose", purpose);

      if (purpose === "homepage_banner") {
        query = query
          .order("display_order", { ascending: true, nullsFirst: false })
          .order("created_at", { ascending: false });
      } else {
        query = query.order("created_at", { ascending: false });
      }
    } else {
      query = query.order("created_at", { ascending: false });
    }

    const { data, error } = await query;

    if (error) throw error;

    const rows = ((data || []) as SiteMediaSearchRow[]).filter((item) => {
      if (!keyword) return true;
      const haystack =
        `${item.file_name || ""} ${item.media_key || ""} ${item.alt_text || ""}`.toLowerCase();
      return haystack.includes(keyword.toLowerCase());
    });

    return NextResponse.json({ media: rows });
  } catch (error: unknown) {
    console.error("Error fetching media:", error);
    return NextResponse.json(
      { error: getErrorMessage(error, "Không thể tải danh sách media") },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest) {
  try {
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

    const storageClient = createStorageAdminClient();
    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    const mediaKeyRaw = (formData.get("mediaKey") as string | null) || "";
    const altTextRaw = (formData.get("altText") as string | null) || "";
    const widthRaw = formData.get("width");
    const heightRaw = formData.get("height");
    const displayOrderRaw = formData.get("displayOrder");
    const width = widthRaw ? parseInt(String(widthRaw), 10) : NaN;
    const height = heightRaw ? parseInt(String(heightRaw), 10) : NaN;
    const displayOrder = displayOrderRaw
      ? parseInt(String(displayOrderRaw), 10)
      : NaN;
    const purpose = normalizePurpose(
      (formData.get("purpose") as string | null) || "site_logo",
    );

    if (!file) {
      return NextResponse.json({ error: "File là bắt buộc" }, { status: 400 });
    }

    if (!file.type.startsWith("image/")) {
      if (!(purpose === "homepage_banner" && file.type.startsWith("video/"))) {
        return NextResponse.json(
          {
            error:
              "Logo/Favicon/QR ngân hàng chỉ hỗ trợ ảnh. Banner trang chủ hỗ trợ ảnh hoặc video",
          },
          { status: 400 },
        );
      }
    }

    if (file.type.startsWith("image/") && file.size > MAX_IMAGE_SIZE) {
      return NextResponse.json(
        { error: "Kích thước ảnh không được vượt quá 12MB" },
        { status: 400 },
      );
    }

    if (file.type.startsWith("video/") && file.size > MAX_VIDEO_SIZE) {
      return NextResponse.json(
        { error: "Kích thước video không được vượt quá 100MB" },
        { status: 400 },
      );
    }

    const mediaKey = mediaKeyRaw.trim() || null;
    const altText = altTextRaw.trim() || null;

    const timestamp = Date.now();
    const randomString = Math.random().toString(36).slice(2, 8);
    const extension = file.name.split(".").pop() || "bin";
    const safeName = file.name.replace(/\s+/g, "-").toLowerCase();
    const filePath = `${STORAGE_PREFIX}/${timestamp}-${randomString}-${safeName.replace(/\.[^.]+$/, "")}.${extension}`;

    const { error: uploadError } = await storageClient.storage
      .from(STORAGE_BUCKET)
      .upload(filePath, file, {
        contentType: file.type,
        cacheControl: "3600",
      });

    if (uploadError) throw uploadError;

    const { data: urlData } = storageClient.storage
      .from(STORAGE_BUCKET)
      .getPublicUrl(filePath);

    let savedMedia = null;
    const storagePathsToDelete: string[] = [];

    try {
      if (SINGLE_MEDIA_PURPOSES.has(purpose)) {
        const { data: existingRows, error: existingError } = await authClient
          .from("site_media_assets")
          .select("id, storage_path")
          .eq("purpose", purpose)
          .order("created_at", { ascending: false });

        if (existingError) throw existingError;

        const existingList = Array.isArray(existingRows)
          ? (existingRows as SiteMediaRefRow[])
          : [];
        const latest = existingList[0] || null;
        const staleRows = existingList.slice(1);
        const staleIds = staleRows.map((item) => item.id);
        const stalePaths = staleRows
          .map((item) => item.storage_path)
          .filter((path): path is string => Boolean(path));

        if (staleIds.length > 0) {
          const { error: deleteStaleError } = await authClient
            .from("site_media_assets")
            .delete()
            .in("id", staleIds);

          if (deleteStaleError) throw deleteStaleError;
          storagePathsToDelete.push(...stalePaths);
        }

        if (latest) {
          const oldStoragePath = latest.storage_path;
          const { data: updated, error: updateError } = await authClient
            .from("site_media_assets")
            .update({
              media_key: mediaKey,
              purpose,
              alt_text: altText,
              file_name: file.name,
              mime_type: file.type,
              file_size: file.size,
              image_url: urlData.publicUrl,
              storage_path: filePath,
              width: Number.isFinite(width) ? width : null,
              height: Number.isFinite(height) ? height : null,
              display_order: null,
              created_by: user.id,
            })
            .eq("id", latest.id)
            .select(
              "id, media_key, purpose, alt_text, file_name, mime_type, file_size, image_url, storage_path, width, height, display_order, created_at",
            )
            .single();

          if (updateError) throw updateError;
          savedMedia = updated;
          if (oldStoragePath) {
            storagePathsToDelete.push(oldStoragePath);
          }
        } else {
          const { data: inserted, error: insertError } = await authClient
            .from("site_media_assets")
            .insert({
              media_key: mediaKey,
              purpose,
              alt_text: altText,
              file_name: file.name,
              mime_type: file.type,
              file_size: file.size,
              image_url: urlData.publicUrl,
              storage_path: filePath,
              width: Number.isFinite(width) ? width : null,
              height: Number.isFinite(height) ? height : null,
              display_order: null,
              created_by: user.id,
            })
            .select(
              "id, media_key, purpose, alt_text, file_name, mime_type, file_size, image_url, storage_path, width, height, display_order, created_at",
            )
            .single();

          if (insertError) throw insertError;
          savedMedia = inserted;
        }
      } else {
        const { data: inserted, error: insertError } = await authClient
          .from("site_media_assets")
          .insert({
            media_key: mediaKey,
            purpose,
            alt_text: altText,
            file_name: file.name,
            mime_type: file.type,
            file_size: file.size,
            image_url: urlData.publicUrl,
            storage_path: filePath,
            width: Number.isFinite(width) ? width : null,
            height: Number.isFinite(height) ? height : null,
            display_order:
              purpose === "homepage_banner" && Number.isFinite(displayOrder)
                ? Math.max(1, displayOrder)
                : null,
            created_by: user.id,
          })
          .select(
            "id, media_key, purpose, alt_text, file_name, mime_type, file_size, image_url, storage_path, width, height, display_order, created_at",
          )
          .single();

        if (insertError) throw insertError;
        savedMedia = inserted;
      }
    } catch (dbError) {
      await storageClient.storage.from(STORAGE_BUCKET).remove([filePath]);
      throw dbError;
    }

    if (storagePathsToDelete.length > 0) {
      const { error: removeOldStorageError } = await storageClient.storage
        .from(STORAGE_BUCKET)
        .remove(storagePathsToDelete);
      if (removeOldStorageError) {
        console.error("Error removing old site media files:", removeOldStorageError);
      }
    }

    return NextResponse.json({ success: true, media: savedMedia });
  } catch (error: unknown) {
    console.error("Error uploading media:", error);
    return NextResponse.json(
      { error: getErrorMessage(error, "Không thể upload media") },
      { status: 500 },
    );
  }
}
