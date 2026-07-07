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

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const auth = await requireAdminRole([...NUTRITION_ROLES]);
    if (isAdminAuthFailure(auth)) return auth.response;

    const { id } = await context.params;
    const supabase = getAdminClient();
    const { data, error } = await supabase
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
      .eq("id", id)
      .single();

    if (error) throw error;

    return NextResponse.json({ article: data });
  } catch (error: unknown) {
    console.error("Error fetching nutrition article:", error);
    return NextResponse.json(
      { error: getErrorMessage(error) || "Không thể tải bài viết" },
      { status: 500 },
    );
  }
}

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const auth = await requireAdminRole([...NUTRITION_ROLES]);
    if (isAdminAuthFailure(auth)) return auth.response;

    const { id } = await context.params;
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
    const { data: currentArticleData } = await supabase
      .from("nutrition_articles")
      .select("status, published_at")
      .eq("id", id)
      .single();
    const currentArticle = currentArticleData as {
      published_at: string | null;
    } | null;

    const nextPublishedAt =
      status === "published"
        ? currentArticle?.published_at || new Date().toISOString()
        : null;

    const { data, error } = await supabase
      .from("nutrition_articles")
      .update({
        title,
        slug: slugifyVietnamese(String(body.slug || title)),
        excerpt: String(body.excerpt || "").trim() || null,
        content,
        cover_image_url: String(body.coverImageUrl || "").trim() || null,
        category_id: String(body.categoryId || "").trim() || null,
        author_name: String(body.authorName || "").trim() || null,
        status,
        related_product_ids: normalizeProductIds(body.relatedProductIds),
        published_at: nextPublishedAt,
      })
      .eq("id", id)
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({
      success: true,
      article: data,
      message: "Đã cập nhật bài viết",
    });
  } catch (error: unknown) {
    console.error("Error updating nutrition article:", error);
    return NextResponse.json(
      { error: getErrorMessage(error) || "Không thể cập nhật bài viết" },
      { status: 500 },
    );
  }
}

export async function DELETE(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const auth = await requireAdminRole([...NUTRITION_ROLES]);
    if (isAdminAuthFailure(auth)) return auth.response;

    const { id } = await context.params;
    const supabase = getAdminClient();
    const { error } = await supabase
      .from("nutrition_articles")
      .delete()
      .eq("id", id);

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    console.error("Error deleting nutrition article:", error);
    return NextResponse.json(
      { error: getErrorMessage(error) || "Không thể xóa bài viết" },
      { status: 500 },
    );
  }
}
