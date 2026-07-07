import { NextRequest, NextResponse } from "next/server";
import { isAdminAuthFailure, requireAdminRole } from "@/lib/adminAuth";
import { createServiceRoleSupabaseClient } from "@/lib/supabase-admin";
import { slugifyVietnamese } from "@/lib/nutrition";
import type { NutritionArticleStatus } from "@/types/database";

const NUTRITION_ROLES = ["admin", "manager"] as const;
const VALID_STATUSES: NutritionArticleStatus[] = [
  "draft",
  "published",
  "archived",
];

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  return "Đã xảy ra lỗi";
}

function getAdminClient() {
  const client = createServiceRoleSupabaseClient();
  if (!client) {
    throw new Error("Thiếu cấu hình SUPABASE_SERVICE_ROLE_KEY");
  }
  return client;
}

function normalizeProductIds(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return Array.from(
    new Set(
      value
        .map((item) => String(item || "").trim())
        .filter((item) => /^[0-9a-f-]{36}$/i.test(item)),
    ),
  );
}

async function resolveUniqueSlug(
  supabase: ReturnType<typeof getAdminClient>,
  baseSlug: string,
): Promise<string> {
  const safeBase = baseSlug || `bai-viet-${Date.now()}`;
  const { data } = await supabase
    .from("nutrition_articles")
    .select("slug")
    .ilike("slug", `${safeBase}%`);

  const existingSlugs = new Set((data || []).map((item) => item.slug));
  if (!existingSlugs.has(safeBase)) return safeBase;

  let index = 2;
  while (existingSlugs.has(`${safeBase}-${index}`)) {
    index += 1;
  }

  return `${safeBase}-${index}`;
}

export async function GET(request: NextRequest) {
  try {
    const auth = await requireAdminRole([...NUTRITION_ROLES]);
    if (isAdminAuthFailure(auth)) return auth.response;

    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status") || "all";
    const categoryId = searchParams.get("categoryId") || "";
    const search = (searchParams.get("search") || "").trim().toLowerCase();

    const supabase = getAdminClient();
    let query = supabase
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
      .order("updated_at", { ascending: false });

    if (VALID_STATUSES.includes(status as NutritionArticleStatus)) {
      query = query.eq("status", status);
    }

    if (categoryId) {
      query = query.eq("category_id", categoryId);
    }

    const { data, error } = await query;
    if (error) throw error;

    let articles = data || [];
    if (search) {
      articles = articles.filter((article) => {
        const haystack = `${article.title} ${article.excerpt || ""}`.toLowerCase();
        return haystack.includes(search);
      });
    }

    return NextResponse.json({ articles });
  } catch (error: unknown) {
    console.error("Error fetching nutrition articles:", error);
    return NextResponse.json(
      { error: getErrorMessage(error) || "Không thể tải bài viết" },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await requireAdminRole([...NUTRITION_ROLES]);
    if (isAdminAuthFailure(auth)) return auth.response;

    const body = await request.json();
    const title = String(body.title || "").trim();
    const content = String(body.content || "").trim();
    const status = VALID_STATUSES.includes(body.status)
      ? (body.status as NutritionArticleStatus)
      : "draft";

    if (title.length < 5) {
      return NextResponse.json(
        { error: "Tiêu đề tối thiểu 5 ký tự" },
        { status: 400 },
      );
    }

    const supabase = getAdminClient();
    const slug = await resolveUniqueSlug(
      supabase,
      slugifyVietnamese(String(body.slug || title)),
    );
    const now = new Date().toISOString();

    const { data, error } = await supabase
      .from("nutrition_articles")
      .insert({
        title,
        slug,
        excerpt: String(body.excerpt || "").trim() || null,
        content,
        cover_image_url: String(body.coverImageUrl || "").trim() || null,
        category_id: String(body.categoryId || "").trim() || null,
        author_name: String(body.authorName || "").trim() || null,
        status,
        related_product_ids: normalizeProductIds(body.relatedProductIds),
        published_at: status === "published" ? now : null,
        created_by: auth.user.id,
      })
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({
      success: true,
      article: data,
      message: "Đã tạo bài viết dinh dưỡng",
    });
  } catch (error: unknown) {
    console.error("Error creating nutrition article:", error);
    return NextResponse.json(
      { error: getErrorMessage(error) || "Không thể tạo bài viết" },
      { status: 500 },
    );
  }
}
