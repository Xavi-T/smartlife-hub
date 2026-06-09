import { NextRequest, NextResponse } from "next/server";
import { isAdminAuthFailure, requireAdminRole } from "@/lib/adminAuth";
import { createServiceRoleSupabaseClient } from "@/lib/supabase-admin";
import { slugifyVietnamese } from "@/lib/nutrition";

const NUTRITION_ROLES = ["admin", "manager", "doctor"] as const;

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

export async function GET() {
  try {
    const auth = await requireAdminRole([...NUTRITION_ROLES]);
    if (isAdminAuthFailure(auth)) return auth.response;

    const supabase = getAdminClient();
    const [{ data: categories, error }, { data: articles }] =
      await Promise.all([
        supabase
          .from("nutrition_categories")
          .select("*")
          .order("name", { ascending: true }),
        supabase.from("nutrition_articles").select("category_id"),
      ]);

    if (error) throw error;

    const articleCount = new Map<string, number>();
    (articles || []).forEach((item) => {
      if (!item.category_id) return;
      articleCount.set(item.category_id, (articleCount.get(item.category_id) || 0) + 1);
    });

    return NextResponse.json({
      categories: (categories || []).map((category) => ({
        ...category,
        article_count: articleCount.get(category.id) || 0,
      })),
    });
  } catch (error: unknown) {
    console.error("Error fetching nutrition categories:", error);
    return NextResponse.json(
      { error: getErrorMessage(error) || "Không thể tải danh mục dinh dưỡng" },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await requireAdminRole([...NUTRITION_ROLES]);
    if (isAdminAuthFailure(auth)) return auth.response;

    const body = await request.json();
    const name = String(body.name || "").trim();
    const description = String(body.description || "").trim();
    const isActive = body.isActive !== false;

    if (name.length < 2) {
      return NextResponse.json(
        { error: "Tên danh mục tối thiểu 2 ký tự" },
        { status: 400 },
      );
    }

    const slug = slugifyVietnamese(name);
    if (!slug) {
      return NextResponse.json(
        { error: "Tên danh mục không hợp lệ" },
        { status: 400 },
      );
    }

    const supabase = getAdminClient();
    const { data, error } = await supabase
      .from("nutrition_categories")
      .upsert(
        {
          name,
          slug,
          description: description || null,
          is_active: isActive,
        },
        { onConflict: "slug" },
      )
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({
      success: true,
      category: data,
      message: "Đã lưu danh mục dinh dưỡng",
    });
  } catch (error: unknown) {
    console.error("Error creating nutrition category:", error);
    return NextResponse.json(
      { error: getErrorMessage(error) || "Không thể tạo danh mục" },
      { status: 500 },
    );
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const auth = await requireAdminRole([...NUTRITION_ROLES]);
    if (isAdminAuthFailure(auth)) return auth.response;

    const body = await request.json();
    const id = String(body.id || "").trim();
    const name = String(body.name || "").trim();
    const description = String(body.description || "").trim();

    if (!id || name.length < 2) {
      return NextResponse.json(
        { error: "ID và tên danh mục là bắt buộc" },
        { status: 400 },
      );
    }

    const supabase = getAdminClient();
    const { data, error } = await supabase
      .from("nutrition_categories")
      .update({
        name,
        slug: slugifyVietnamese(name),
        description: description || null,
        is_active: body.isActive !== false,
      })
      .eq("id", id)
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ success: true, category: data });
  } catch (error: unknown) {
    console.error("Error updating nutrition category:", error);
    return NextResponse.json(
      { error: getErrorMessage(error) || "Không thể cập nhật danh mục" },
      { status: 500 },
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const auth = await requireAdminRole([...NUTRITION_ROLES]);
    if (isAdminAuthFailure(auth)) return auth.response;

    const id = new URL(request.url).searchParams.get("id") || "";
    if (!id) {
      return NextResponse.json(
        { error: "Category ID là bắt buộc" },
        { status: 400 },
      );
    }

    const supabase = getAdminClient();
    const { count, error: countError } = await supabase
      .from("nutrition_articles")
      .select("id", { count: "exact", head: true })
      .eq("category_id", id);

    if (countError) throw countError;

    if ((count || 0) > 0) {
      return NextResponse.json(
        { error: "Danh mục đang được sử dụng bởi bài viết" },
        { status: 400 },
      );
    }

    const { error } = await supabase
      .from("nutrition_categories")
      .delete()
      .eq("id", id);

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    console.error("Error deleting nutrition category:", error);
    return NextResponse.json(
      { error: getErrorMessage(error) || "Không thể xóa danh mục" },
      { status: 500 },
    );
  }
}
