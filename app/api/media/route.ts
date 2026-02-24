import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase-server";

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  return "Không thể tải media";
}

export async function GET(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient();
    const { searchParams } = new URL(request.url);
    const mediaKey = (searchParams.get("key") || "").trim();
    const purpose = (searchParams.get("purpose") || "").trim();

    let query = (supabase as any)
      .from("site_media_assets")
      .select(
        "id, media_key, purpose, alt_text, file_name, mime_type, file_size, image_url, width, height, created_at",
      )
      .order("created_at", { ascending: false });

    if (mediaKey) {
      query = query.eq("media_key", mediaKey);
    }

    if (purpose) {
      query = query.eq("purpose", purpose);
    }

    const { data, error } = await query;

    if (error) throw error;

    return NextResponse.json({ media: data || [] });
  } catch (error: unknown) {
    console.error("Error fetching public media:", error);
    return NextResponse.json(
      { error: getErrorMessage(error) },
      { status: 500 },
    );
  }
}
