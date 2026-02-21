import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

function detectMediaType(url: string): "image" | "video" {
  const normalized = url.toLowerCase();
  return /\.(mp4|webm|mov|m4v)(\?|#|$)/.test(normalized) ? "video" : "image";
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

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await context.params;
    if (!id) {
      return NextResponse.json(
        { error: "Product ID là bắt buộc" },
        { status: 400 },
      );
    }

    const supabase = await createApiSupabaseClient();
    const { data, error } = await supabase
      .from("product_images")
      .select(
        "id, image_url, storage_path, display_order, is_cover, width, height, created_at",
      )
      .eq("product_id", id)
      .order("is_cover", { ascending: false })
      .order("display_order", { ascending: true })
      .order("created_at", { ascending: true });

    if (error) throw error;

    const mapped = (data || []).map((item) => ({
      ...item,
      media_type: detectMediaType(item.image_url || ""),
    }));

    return NextResponse.json(mapped);
  } catch (error) {
    console.error("Error fetching product media:", error);
    return NextResponse.json(
      { error: "Không thể tải media sản phẩm" },
      { status: 500 },
    );
  }
}
