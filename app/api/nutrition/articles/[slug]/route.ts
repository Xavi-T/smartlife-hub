import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

function createPublicClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    },
  );
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  return "Không thể tải bài viết";
}

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ slug: string }> },
) {
  try {
    const { slug } = await context.params;
    const supabase = createPublicClient();
    const { data: article, error } = await supabase
      .from("nutrition_articles")
      .select(
        `
        *,
        nutrition_categories(
          id,
          name,
          slug,
          description,
          is_active,
          created_at,
          updated_at
        )
      `,
      )
      .eq("slug", slug)
      .eq("status", "published")
      .single();

    if (error) throw error;

    const productIds = Array.isArray(article.related_product_ids)
      ? article.related_product_ids
      : [];
    const { data: products } =
      productIds.length > 0
        ? await supabase
            .from("products")
            .select("id, name, price, discount_percent, image_url, category, stock_quantity, is_active, created_at, updated_at, description, cost_price, discount_start_at, discount_end_at")
            .in("id", productIds)
            .eq("is_active", true)
        : { data: [] };

    return NextResponse.json(
      { article, relatedProducts: products || [] },
      {
        headers: {
          "Cache-Control": "no-store, max-age=0",
        },
      },
    );
  } catch (error: unknown) {
    console.error("Error fetching public nutrition article:", error);
    return NextResponse.json(
      { error: getErrorMessage(error) },
      { status: 500 },
    );
  }
}
