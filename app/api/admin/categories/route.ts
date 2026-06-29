import { NextRequest, NextResponse } from "next/server";
import { isAdminAuthFailure, requireAdminRole } from "@/lib/adminAuth";
import { createServiceRoleSupabaseClient } from "@/lib/supabase-admin";

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  return "Đã xảy ra lỗi";
}

function slugify(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/đ/g, "d")
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function getAdminClient() {
  const client = createServiceRoleSupabaseClient();
  if (!client) {
    throw new Error("Thiếu cấu hình SUPABASE_SERVICE_ROLE_KEY");
  }
  return client;
}

function migrationErrorResponse(error: { code?: string; message?: string }) {
  if (
    error.code === "PGRST202" ||
    error.message?.includes("Could not find the function")
  ) {
    return NextResponse.json(
      {
        error:
          "Chưa cài đặt chức năng quản lý danh mục. Hãy chạy file database/category_management_schema.sql trên Supabase.",
      },
      { status: 503 },
    );
  }

  return null;
}

function parseName(body: Record<string, unknown>): {
  name: string;
  slugBase: string;
} {
  const name = typeof body.name === "string" ? body.name.trim() : "";

  if (!name) {
    throw new Error("Tên danh mục là bắt buộc");
  }

  if (name.length > 100) {
    throw new Error("Tên danh mục tối đa 100 ký tự");
  }

  const slugBase = slugify(name);
  if (!slugBase) {
    throw new Error("Tên danh mục không hợp lệ");
  }

  return { name, slugBase };
}

export async function GET() {
  try {
    const auth = await requireAdminRole();
    if (isAdminAuthFailure(auth)) return auth.response;

    const supabase = getAdminClient();
    const [{ data: categories, error }, { data: links, error: linkError }] =
      await Promise.all([
        supabase
          .from("categories")
          .select("id, name, slug, is_active, created_at, updated_at")
          .order("name", { ascending: true }),
        supabase.from("product_categories").select("category_id"),
      ]);

    if (error) throw error;
    if (linkError) throw linkError;

    const productCountMap = (links || []).reduce<Record<string, number>>(
      (acc, item) => {
        acc[item.category_id] = (acc[item.category_id] || 0) + 1;
        return acc;
      },
      {},
    );

    return NextResponse.json({
      categories: (categories || []).map((category) => ({
        ...category,
        product_count: productCountMap[category.id] || 0,
      })),
    });
  } catch (error: unknown) {
    console.error("Error fetching categories:", error);
    return NextResponse.json(
      { error: getErrorMessage(error) || "Không thể tải danh mục" },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await requireAdminRole();
    if (isAdminAuthFailure(auth)) return auth.response;

    const body = (await request.json()) as Record<string, unknown>;
    const { name, slugBase } = parseName(body);
    const supabase = getAdminClient();
    const { data, error } = await supabase.rpc("save_product_category", {
      p_category_id: null,
      p_name: name,
      p_slug_base: slugBase,
    });

    if (error) {
      const migrationResponse = migrationErrorResponse(error);
      if (migrationResponse) return migrationResponse;
      throw error;
    }

    return NextResponse.json({
      success: true,
      category: data?.category,
    });
  } catch (error: unknown) {
    console.error("Error creating category:", error);
    return NextResponse.json(
      { error: getErrorMessage(error) || "Không thể tạo danh mục" },
      { status: 400 },
    );
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const auth = await requireAdminRole();
    if (isAdminAuthFailure(auth)) return auth.response;

    const body = (await request.json()) as Record<string, unknown>;
    const action = body.action === "merge" ? "merge" : "update";
    const { name, slugBase } = parseName(body);
    const supabase = getAdminClient();

    if (action === "merge") {
      const categoryIds = Array.isArray(body.ids)
        ? body.ids.filter(
            (value): value is string =>
              typeof value === "string" && value.length > 0,
          )
        : [];

      if (new Set(categoryIds).size < 2) {
        return NextResponse.json(
          { error: "Cần chọn ít nhất 2 danh mục để gộp" },
          { status: 400 },
        );
      }

      const { data, error } = await supabase.rpc("merge_product_categories", {
        p_category_ids: categoryIds,
        p_name: name,
        p_slug_base: slugBase,
      });

      if (error) {
        const migrationResponse = migrationErrorResponse(error);
        if (migrationResponse) return migrationResponse;
        throw error;
      }

      return NextResponse.json({ success: true, ...data });
    }

    const categoryId =
      typeof body.id === "string" ? body.id.trim() : "";
    if (!categoryId) {
      return NextResponse.json(
        { error: "Category ID là bắt buộc" },
        { status: 400 },
      );
    }

    const { data, error } = await supabase.rpc("save_product_category", {
      p_category_id: categoryId,
      p_name: name,
      p_slug_base: slugBase,
    });

    if (error) {
      const migrationResponse = migrationErrorResponse(error);
      if (migrationResponse) return migrationResponse;
      throw error;
    }

    return NextResponse.json({ success: true, ...data });
  } catch (error: unknown) {
    console.error("Error updating categories:", error);
    return NextResponse.json(
      { error: getErrorMessage(error) || "Không thể cập nhật danh mục" },
      { status: 400 },
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const auth = await requireAdminRole();
    if (isAdminAuthFailure(auth)) return auth.response;

    let body: Record<string, unknown> = {};
    try {
      body = (await request.json()) as Record<string, unknown>;
    } catch {
      // Keep compatibility with the old single-delete query parameter.
    }

    const queryId = new URL(request.url).searchParams.get("id");
    const categoryIds = Array.isArray(body.ids)
      ? body.ids.filter(
          (value): value is string =>
            typeof value === "string" && value.length > 0,
        )
      : queryId
        ? [queryId]
        : [];

    if (categoryIds.length === 0) {
      return NextResponse.json(
        { error: "Chưa chọn danh mục cần xóa" },
        { status: 400 },
      );
    }

    const supabase = getAdminClient();
    const { data, error } = await supabase.rpc("delete_product_categories", {
      p_category_ids: categoryIds,
    });

    if (error) {
      const migrationResponse = migrationErrorResponse(error);
      if (migrationResponse) return migrationResponse;
      throw error;
    }

    return NextResponse.json({ success: true, ...data });
  } catch (error: unknown) {
    console.error("Error deleting categories:", error);
    return NextResponse.json(
      { error: getErrorMessage(error) || "Không thể xóa danh mục" },
      { status: 400 },
    );
  }
}
