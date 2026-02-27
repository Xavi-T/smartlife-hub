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

    type SiteMediaQuery = {
      eq: (column: string, value: string) => SiteMediaQuery;
      order: (
        column: string,
        options: { ascending: boolean; nullsFirst?: boolean },
      ) => SiteMediaQuery;
      then: PromiseLike<{
        data: Array<Record<string, unknown>> | null;
        error: unknown;
      }>["then"];
    };

    const siteMediaApi = supabase as unknown as {
      from: (table: string) => {
        select: (columns: string) => SiteMediaQuery;
      };
    };

    let query = siteMediaApi
      .from("site_media_assets")
      .select(
        "id, media_key, purpose, alt_text, file_name, mime_type, file_size, image_url, width, height, display_order, created_at",
      );

    if (mediaKey) {
      query = query.eq("media_key", mediaKey);
    }

    if (purpose) {
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

    return NextResponse.json(
      { media: data || [] },
      {
        headers: {
          "Cache-Control": "public, max-age=120, stale-while-revalidate=600",
        },
      },
    );
  } catch (error: unknown) {
    console.error("Error fetching public media:", error);
    return NextResponse.json(
      { error: getErrorMessage(error) },
      { status: 500 },
    );
  }
}
