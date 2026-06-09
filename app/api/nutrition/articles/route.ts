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

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const categorySlug = searchParams.get("category") || "";
    const search = (searchParams.get("search") || "").trim().toLowerCase();
    const supabase = createPublicClient();

    let categoryId = "";
    if (categorySlug) {
      const { data: category } = await supabase
        .from("nutrition_categories")
        .select("id")
        .eq("slug", categorySlug)
        .eq("is_active", true)
        .maybeSingle();
      categoryId = category?.id || "";
    }

    let query = supabase
      .from("nutrition_articles")
      .select(
        `
        id,
        title,
        slug,
        excerpt,
        cover_image_url,
        category_id,
        author_name,
        status,
        published_at,
        created_at,
        updated_at,
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
      .eq("status", "published")
      .order("published_at", { ascending: false });

    if (categoryId) {
      query = query.eq("category_id", categoryId);
    }

    const [{ data: articles, error }, { data: categories }] =
      await Promise.all([
        query,
        supabase
          .from("nutrition_categories")
          .select("*")
          .eq("is_active", true)
          .order("name", { ascending: true }),
      ]);

    if (error) throw error;

    let rows = articles || [];
    if (search) {
      rows = rows.filter((article) => {
        const haystack = `${article.title} ${article.excerpt || ""}`.toLowerCase();
        return haystack.includes(search);
      });
    }

    return NextResponse.json(
      { articles: rows, categories: categories || [] },
      {
        headers: {
          "Cache-Control": "no-store, max-age=0",
        },
      },
    );
  } catch (error: unknown) {
    console.error("Error fetching public nutrition articles:", error);
    return NextResponse.json(
      { error: getErrorMessage(error) },
      { status: 500 },
    );
  }
}
