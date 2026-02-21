import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";

const BUCKET_NAME = "product-images";
const MEDIA_ROOT = "media-library";

interface StorageFile {
  name: string;
  id: string | null;
  updated_at: string | null;
  created_at: string | null;
  metadata: {
    size?: number;
    mimetype?: string;
  } | null;
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  return "Đã xảy ra lỗi";
}

function normalizeRelativePath(input: string | null | undefined): string {
  if (!input) return "";
  return input
    .trim()
    .replace(/^\/+|\/+$/g, "")
    .replace(/\.{2,}/g, "")
    .replace(/\/{2,}/g, "/");
}

function sanitizeSegment(input: string): string {
  return input.trim().replace(/\//g, "-").replace(/\s+/g, " ");
}

function buildObjectPath(relativePath = ""): string {
  const normalized = normalizeRelativePath(relativePath);
  return normalized ? `${MEDIA_ROOT}/${normalized}` : MEDIA_ROOT;
}

function getParentPath(relativePath: string): string | null {
  const normalized = normalizeRelativePath(relativePath);
  if (!normalized) return null;

  const parts = normalized.split("/");
  parts.pop();
  return parts.join("/") || null;
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
      "Thiếu SUPABASE_SERVICE_ROLE_KEY. Cần cấu hình biến môi trường để ghi/xóa file media.",
    );
  }

  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

function isStorageRlsError(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const maybeError = error as { statusCode?: string; message?: string };
  return (
    maybeError.statusCode === "403" ||
    maybeError.message?.toLowerCase().includes("row-level security") === true
  );
}

async function listFilesRecursive(
  supabase: Awaited<ReturnType<typeof createApiSupabaseClient>>,
  objectPrefix: string,
): Promise<string[]> {
  const results: string[] = [];

  const walk = async (prefix: string) => {
    const { data, error } = await supabase.storage
      .from(BUCKET_NAME)
      .list(prefix, {
        limit: 1000,
        offset: 0,
      });

    if (error) throw error;

    for (const item of (data || []) as StorageFile[]) {
      if (item.id === null) {
        await walk(`${prefix}/${item.name}`);
      } else {
        results.push(`${prefix}/${item.name}`);
      }
    }
  };

  await walk(objectPrefix);
  return results;
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

    const storageClient = createStorageAdminClient();
    const { searchParams } = new URL(request.url);
    const path = normalizeRelativePath(searchParams.get("path"));
    const objectPrefix = buildObjectPath(path);

    const { data, error } = await storageClient.storage
      .from(BUCKET_NAME)
      .list(objectPrefix, {
        limit: 1000,
        offset: 0,
        sortBy: { column: "name", order: "asc" },
      });

    if (error) throw error;

    const folders = (data || [])
      .filter((item) => item.id === null)
      .map((item) => ({
        name: item.name,
        path: normalizeRelativePath(path ? `${path}/${item.name}` : item.name),
      }));

    const files = (data || [])
      .filter((item) => item.id !== null && item.name !== ".folder")
      .map((item) => {
        const relativePath = normalizeRelativePath(
          path ? `${path}/${item.name}` : item.name,
        );
        const objectPath = buildObjectPath(relativePath);
        const { data: urlData } = storageClient.storage
          .from(BUCKET_NAME)
          .getPublicUrl(objectPath);

        return {
          name: item.name,
          path: relativePath,
          url: urlData.publicUrl,
          size: item.metadata?.size ?? 0,
          mimeType: item.metadata?.mimetype ?? null,
          createdAt: item.created_at,
          updatedAt: item.updated_at,
        };
      });

    return NextResponse.json({
      currentPath: path,
      parentPath: getParentPath(path),
      folders,
      files,
    });
  } catch (error: unknown) {
    console.error("Error listing media:", error);
    return NextResponse.json(
      { error: getErrorMessage(error) || "Không thể tải thư viện media" },
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
    const action = String(formData.get("action") || "upload");

    if (action === "create-folder") {
      const parentPath = normalizeRelativePath(
        formData.get("parentPath") as string,
      );
      const folderName = sanitizeSegment(
        String(formData.get("folderName") || ""),
      );

      if (!folderName) {
        return NextResponse.json(
          { error: "Tên folder là bắt buộc" },
          { status: 400 },
        );
      }

      const relativeFolderPath = normalizeRelativePath(
        parentPath ? `${parentPath}/${folderName}` : folderName,
      );

      const placeholderPath = `${buildObjectPath(relativeFolderPath)}/.folder`;
      const { error } = await storageClient.storage
        .from(BUCKET_NAME)
        .upload(placeholderPath, new Blob(["folder"]), {
          contentType: "text/plain",
          upsert: false,
        });

      if (error) throw error;

      return NextResponse.json({
        success: true,
        folder: {
          name: folderName,
          path: relativeFolderPath,
        },
      });
    }

    const file = formData.get("file") as File | null;
    const folderPath = normalizeRelativePath(
      formData.get("folderPath") as string,
    );

    if (!file) {
      return NextResponse.json({ error: "File là bắt buộc" }, { status: 400 });
    }

    const ext = file.name.split(".").pop();
    const safeExt = ext ? ext.toLowerCase() : "jpg";
    const fileName = `${Date.now()}_${Math.random().toString(36).slice(2)}.${safeExt}`;
    const relativePath = normalizeRelativePath(
      folderPath ? `${folderPath}/${fileName}` : fileName,
    );

    const { error: uploadError } = await storageClient.storage
      .from(BUCKET_NAME)
      .upload(buildObjectPath(relativePath), file, {
        contentType: file.type,
        cacheControl: "3600",
        upsert: false,
      });

    if (uploadError) throw uploadError;

    const { data: urlData } = storageClient.storage
      .from(BUCKET_NAME)
      .getPublicUrl(buildObjectPath(relativePath));

    return NextResponse.json({
      success: true,
      file: {
        name: fileName,
        path: relativePath,
        url: urlData.publicUrl,
        size: file.size,
        mimeType: file.type,
      },
    });
  } catch (error: unknown) {
    console.error("Error creating media:", error);
    if (isStorageRlsError(error)) {
      return NextResponse.json(
        {
          error:
            "Không có quyền ghi media. Vui lòng kiểm tra RLS bucket hoặc cấu hình service role key.",
        },
        { status: 403 },
      );
    }
    return NextResponse.json(
      { error: getErrorMessage(error) || "Không thể xử lý media" },
      { status: 500 },
    );
  }
}

export async function PATCH(request: NextRequest) {
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
    const body = await request.json();
    const action = String(body.action || "");

    if (action === "rename-file") {
      const oldPath = normalizeRelativePath(body.path);
      const newName = sanitizeSegment(String(body.newName || ""));

      if (!oldPath || !newName) {
        return NextResponse.json(
          { error: "Thông tin đổi tên file không hợp lệ" },
          { status: 400 },
        );
      }

      const parentPath = getParentPath(oldPath);
      const newPath = normalizeRelativePath(
        parentPath ? `${parentPath}/${newName}` : newName,
      );

      const { error } = await storageClient.storage
        .from(BUCKET_NAME)
        .move(buildObjectPath(oldPath), buildObjectPath(newPath));

      if (error) throw error;
      return NextResponse.json({ success: true, path: newPath });
    }

    if (action === "rename-folder") {
      const oldFolderPath = normalizeRelativePath(body.path);
      const newFolderName = sanitizeSegment(String(body.newName || ""));

      if (!oldFolderPath || !newFolderName) {
        return NextResponse.json(
          { error: "Thông tin đổi tên folder không hợp lệ" },
          { status: 400 },
        );
      }

      const parentPath = getParentPath(oldFolderPath);
      const newFolderPath = normalizeRelativePath(
        parentPath ? `${parentPath}/${newFolderName}` : newFolderName,
      );

      const oldPrefix = buildObjectPath(oldFolderPath);
      const newPrefix = buildObjectPath(newFolderPath);

      const allObjects = await listFilesRecursive(storageClient, oldPrefix);

      for (const oldObjectPath of allObjects) {
        const suffix = oldObjectPath.slice(oldPrefix.length + 1);
        const newObjectPath = `${newPrefix}/${suffix}`;
        const { error } = await storageClient.storage
          .from(BUCKET_NAME)
          .move(oldObjectPath, newObjectPath);
        if (error) throw error;
      }

      return NextResponse.json({ success: true, path: newFolderPath });
    }

    return NextResponse.json({ error: "Action không hợp lệ" }, { status: 400 });
  } catch (error: unknown) {
    console.error("Error updating media:", error);
    if (isStorageRlsError(error)) {
      return NextResponse.json(
        {
          error:
            "Không có quyền cập nhật media. Vui lòng kiểm tra RLS bucket hoặc cấu hình service role key.",
        },
        { status: 403 },
      );
    }
    return NextResponse.json(
      { error: getErrorMessage(error) || "Không thể cập nhật media" },
      { status: 500 },
    );
  }
}

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
    const path = normalizeRelativePath(searchParams.get("path"));
    const type = String(searchParams.get("type") || "file");

    if (!path) {
      return NextResponse.json(
        { error: "Đường dẫn là bắt buộc" },
        { status: 400 },
      );
    }

    if (type === "folder") {
      const objectPrefix = buildObjectPath(path);
      const allObjects = await listFilesRecursive(storageClient, objectPrefix);

      if (allObjects.length > 0) {
        const { error } = await storageClient.storage
          .from(BUCKET_NAME)
          .remove(allObjects);
        if (error) throw error;
      }

      return NextResponse.json({ success: true, message: "Đã xóa folder" });
    }

    const { error } = await storageClient.storage
      .from(BUCKET_NAME)
      .remove([buildObjectPath(path)]);

    if (error) throw error;

    return NextResponse.json({ success: true, message: "Đã xóa file" });
  } catch (error: unknown) {
    console.error("Error deleting media:", error);
    if (isStorageRlsError(error)) {
      return NextResponse.json(
        {
          error:
            "Không có quyền xóa media. Vui lòng kiểm tra RLS bucket hoặc cấu hình service role key.",
        },
        { status: 403 },
      );
    }
    return NextResponse.json(
      { error: getErrorMessage(error) || "Không thể xóa media" },
      { status: 500 },
    );
  }
}
