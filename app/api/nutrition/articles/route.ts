import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const PUBLIC_ARTICLE_CACHE_CONTROL =
  "public, max-age=60, stale-while-revalidate=300";

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

function sanitizeSearchTerm(value: string): string {
  return value
    .replace(/[()%,.*_]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 120);
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const categorySlug = searchParams.get("category") || "";
    const search = (searchParams.get("search") || "").trim();
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

    if (search) {
      const safeSearch = sanitizeSearchTerm(search);
      if (safeSearch) {
        query = query.or(
          `title.ilike.%${safeSearch}%,excerpt.ilike.%${safeSearch}%`,
        );
      }
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

    return NextResponse.json(
      { articles: articles || [], categories: categories || [] },
      {
        headers: {
          "Cache-Control": PUBLIC_ARTICLE_CACHE_CONTROL,
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
