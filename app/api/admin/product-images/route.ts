import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";

const MAX_IMAGE_SIZE = 10 * 1024 * 1024;
const MAX_VIDEO_SIZE = 100 * 1024 * 1024;

function isVideoMimeType(mimeType: string): boolean {
  return mimeType.startsWith("video/");
}

function normalizeStoragePath(path: string): string {
  const normalized = path.trim().replace(/^\/+/, "");
  if (!normalized) return normalized;
  if (
    normalized.startsWith("media-library/") ||
    normalized.startsWith("products/")
  ) {
    return normalized;
  }
  return `media-library/${normalized}`;
}

function getErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message) {
    return error.message;
  }
  return fallback;
}

function isStorageRlsError(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const maybeError = error as { statusCode?: string; message?: string };
  return (
    maybeError.statusCode === "403" ||
    maybeError.message?.toLowerCase().includes("row-level security") === true
  );
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
    throw new Error(
      "Thiếu SUPABASE_SERVICE_ROLE_KEY. Cần cấu hình biến môi trường để ghi/xóa media sản phẩm.",
    );
  }

  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

// GET: Lấy tất cả ảnh của sản phẩm
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
    const productId = searchParams.get("productId");

    if (!productId) {
      return NextResponse.json(
        { error: "Product ID là bắt buộc" },
        { status: 400 },
      );
    }

    const { data, error } = await authClient
      .from("product_images")
      .select("*")
      .eq("product_id", productId)
      .order("display_order", { ascending: true });

    if (error) throw error;

    return NextResponse.json(data);
  } catch (error: unknown) {
    console.error("Error fetching product images:", error);
    return NextResponse.json(
      { error: getErrorMessage(error, "Không thể tải danh sách ảnh") },
      { status: 500 },
    );
  }
}

// POST: Upload media mới hoặc gắn media từ thư viện vào sản phẩm
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
    const productId = formData.get("productId") as string;
    const isCover = formData.get("isCover") === "true";
    const widthRaw = formData.get("width");
    const heightRaw = formData.get("height");
    const width = widthRaw ? parseInt(String(widthRaw), 10) : NaN;
    const height = heightRaw ? parseInt(String(heightRaw), 10) : NaN;
    const mediaUrl = String(formData.get("mediaUrl") || "").trim();
    const storagePathRaw = String(formData.get("storagePath") || "").trim();
    const source = String(formData.get("source") || "upload");

    if (!productId) {
      return NextResponse.json(
        { error: "Product ID là bắt buộc" },
        { status: 400 },
      );
    }

    if (source === "library") {
      if (!mediaUrl || !storagePathRaw) {
        return NextResponse.json(
          { error: "Thiếu mediaUrl hoặc storagePath để gắn từ thư viện" },
          { status: 400 },
        );
      }

      const storagePath = normalizeStoragePath(storagePathRaw);

      const { data: imageRecord, error: dbError } = await authClient
        .from("product_images")
        .insert({
          product_id: productId,
          image_url: mediaUrl,
          storage_path: storagePath,
          is_cover: isCover,
          file_size: null,
          width: null,
          height: null,
        })
        .select()
        .single();

      if (dbError) throw dbError;

      return NextResponse.json({
        success: true,
        image: imageRecord,
      });
    }

    if (!file) {
      return NextResponse.json({ error: "File là bắt buộc" }, { status: 400 });
    }

    if (!file.type.startsWith("image/") && !file.type.startsWith("video/")) {
      return NextResponse.json(
        { error: "Chỉ hỗ trợ ảnh hoặc video" },
        { status: 400 },
      );
    }

    if (isVideoMimeType(file.type) && file.size > MAX_VIDEO_SIZE) {
      return NextResponse.json(
        { error: "Video không được vượt quá 100MB" },
        { status: 400 },
      );
    }

    if (!isVideoMimeType(file.type) && file.size > MAX_IMAGE_SIZE) {
      return NextResponse.json(
        { error: "Ảnh không được vượt quá 10MB" },
        { status: 400 },
      );
    }

    // Generate unique filename
    const timestamp = Date.now();
    const randomString = Math.random().toString(36).substring(7);
    const fileExt = file.name.split(".").pop() || "bin";
    const fileName = `${productId}_${timestamp}_${randomString}.${fileExt}`;
    const folderName = isVideoMimeType(file.type)
      ? "products/videos"
      : "products/images";
    const filePath = `${folderName}/${fileName}`;

    // Upload to Supabase Storage
    const { error: uploadError } = await storageClient.storage
      .from("product-images")
      .upload(filePath, file, {
        contentType: file.type,
        cacheControl: "3600",
      });

    if (uploadError) throw uploadError;

    // Get public URL
    const { data: urlData } = storageClient.storage
      .from("product-images")
      .getPublicUrl(filePath);

    // Save to database
    const { data: imageRecord, error: dbError } = await authClient
      .from("product_images")
      .insert({
        product_id: productId,
        image_url: urlData.publicUrl,
        storage_path: filePath,
        is_cover: isCover,
        file_size: file.size,
        width: Number.isFinite(width) ? width : null,
        height: Number.isFinite(height) ? height : null,
      })
      .select()
      .single();

    if (dbError) throw dbError;

    return NextResponse.json({
      success: true,
      image: imageRecord,
    });
  } catch (error: unknown) {
    console.error("Error uploading image:", error);
    if (isStorageRlsError(error)) {
      return NextResponse.json(
        {
          error:
            "Không có quyền ghi media sản phẩm. Vui lòng kiểm tra RLS bucket hoặc cấu hình SUPABASE_SERVICE_ROLE_KEY.",
        },
        { status: 403 },
      );
    }
    return NextResponse.json(
      { error: getErrorMessage(error, "Không thể upload ảnh") },
      { status: 500 },
    );
  }
}

// DELETE: Xóa ảnh
export async function DELETE(request: NextRequest) {
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
    const { searchParams } = new URL(request.url);
    const imageId = searchParams.get("imageId");

    if (!imageId) {
      return NextResponse.json(
        { error: "Image ID là bắt buộc" },
        { status: 400 },
      );
    }

    // Get image info
    const { data: image, error: fetchError } = await authClient
      .from("product_images")
      .select("*")
      .eq("id", imageId)
      .single();

    if (fetchError) throw fetchError;

    // Delete from storage
    const shouldDeleteObject =
      typeof image.storage_path === "string" &&
      image.storage_path.startsWith("products/");

    if (shouldDeleteObject) {
      const { error: storageError } = await storageClient.storage
        .from("product-images")
        .remove([image.storage_path]);

      if (storageError) {
        console.error("Storage delete error:", storageError);
        // Continue even if storage delete fails
      }
    }

    // Delete from database
    const { error: dbError } = await authClient
      .from("product_images")
      .delete()
      .eq("id", imageId);

    if (dbError) throw dbError;

    return NextResponse.json({
      success: true,
      message: "Đã xóa ảnh thành công",
    });
  } catch (error: unknown) {
    console.error("Error deleting image:", error);
    if (isStorageRlsError(error)) {
      return NextResponse.json(
        {
          error:
            "Không có quyền xóa media sản phẩm. Vui lòng kiểm tra RLS bucket hoặc cấu hình SUPABASE_SERVICE_ROLE_KEY.",
        },
        { status: 403 },
      );
    }
    return NextResponse.json(
      { error: getErrorMessage(error, "Không thể xóa ảnh") },
      { status: 500 },
    );
  }
}
