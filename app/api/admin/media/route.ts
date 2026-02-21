import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

const BUCKET_NAME = "product-images";
const MEDIA_FOLDER = "media-library";

interface StorageFile {
  name: string;
  id: string | null;
  updated_at: string | null;
  created_at: string | null;
  last_accessed_at: string | null;
  metadata: {
    size?: number;
    mimetype?: string;
  } | null;
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  return "Đã xảy ra lỗi";
}

export async function GET() {
  try {
    const { data, error } = await supabase.storage
      .from(BUCKET_NAME)
      .list(MEDIA_FOLDER, {
        limit: 200,
        offset: 0,
        sortBy: { column: "created_at", order: "desc" },
      });

    if (error) throw error;

    const files = ((data || []) as StorageFile[])
      .filter((file) => file.name && !file.name.endsWith("/"))
      .map((file) => {
        const path = `${MEDIA_FOLDER}/${file.name}`;
        const { data: urlData } = supabase.storage
          .from(BUCKET_NAME)
          .getPublicUrl(path);

        return {
          name: file.name,
          path,
          url: urlData.publicUrl,
          size: file.metadata?.size ?? 0,
          mimeType: file.metadata?.mimetype ?? null,
          createdAt: file.created_at,
          updatedAt: file.updated_at,
        };
      });

    return NextResponse.json({ files });
  } catch (error: unknown) {
    console.error("Error listing media files:", error);
    return NextResponse.json(
      { error: getErrorMessage(error) || "Không thể tải thư viện media" },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json({ error: "File là bắt buộc" }, { status: 400 });
    }

    const ext = file.name.split(".").pop();
    const safeExt = ext ? ext.toLowerCase() : "jpg";
    const fileName = `${Date.now()}_${Math.random().toString(36).slice(2)}.${safeExt}`;
    const filePath = `${MEDIA_FOLDER}/${fileName}`;

    const { error: uploadError } = await supabase.storage
      .from(BUCKET_NAME)
      .upload(filePath, file, {
        contentType: file.type,
        cacheControl: "3600",
        upsert: false,
      });

    if (uploadError) throw uploadError;

    const { data: urlData } = supabase.storage
      .from(BUCKET_NAME)
      .getPublicUrl(filePath);

    return NextResponse.json({
      success: true,
      file: {
        name: fileName,
        path: filePath,
        url: urlData.publicUrl,
        size: file.size,
        mimeType: file.type,
      },
    });
  } catch (error: unknown) {
    console.error("Error uploading media file:", error);
    return NextResponse.json(
      { error: getErrorMessage(error) || "Không thể upload media" },
      { status: 500 },
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const path = searchParams.get("path");

    if (!path) {
      return NextResponse.json(
        { error: "Đường dẫn file là bắt buộc" },
        { status: 400 },
      );
    }

    const { error } = await supabase.storage.from(BUCKET_NAME).remove([path]);
    if (error) throw error;

    return NextResponse.json({ success: true, message: "Đã xóa file" });
  } catch (error: unknown) {
    console.error("Error deleting media file:", error);
    return NextResponse.json(
      { error: getErrorMessage(error) || "Không thể xóa media" },
      { status: 500 },
    );
  }
}
