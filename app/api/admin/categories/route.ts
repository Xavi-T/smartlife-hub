import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  return "Đã xảy ra lỗi";
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

function slugify(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export async function GET() {
  try {
    const supabase = await createApiSupabaseClient();
    const { data: categories, error } = await supabase
      .from("categories")
      .select("id, name, slug, is_active, created_at, updated_at")
      .order("name", { ascending: true });

    if (error) throw error;

    const { data: links, error: linkError } = await supabase
      .from("product_categories")
      .select("category_id");

    if (linkError) throw linkError;

    const productCountMap = (links || []).reduce<Record<string, number>>(
      (acc, item) => {
        acc[item.category_id] = (acc[item.category_id] || 0) + 1;
        return acc;
      },
      {},
    );

    return NextResponse.json({
      categories: (categories || []).map((cat) => ({
        ...cat,
        product_count: productCountMap[cat.id] || 0,
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
    const supabase = await createApiSupabaseClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json(
        { error: "Bạn chưa đăng nhập" },
        { status: 401 },
      );
    }

    const body = await request.json();
    const rawName = typeof body.name === "string" ? body.name.trim() : "";

    if (!rawName) {
      return NextResponse.json(
        { error: "Tên danh mục là bắt buộc" },
        { status: 400 },
      );
    }

    const slug = slugify(rawName);
    if (!slug) {
      return NextResponse.json(
        { error: "Tên danh mục không hợp lệ" },
        { status: 400 },
      );
    }

    const { data, error } = await supabase
      .from("categories")
      .upsert(
        {
          name: rawName,
          slug,
          is_active: true,
        },
        { onConflict: "slug" },
      )
      .select("id, name, slug, is_active, created_at, updated_at")
      .single();

    if (error) throw error;

    return NextResponse.json({ success: true, category: data });
  } catch (error: unknown) {
    console.error("Error creating category:", error);
    return NextResponse.json(
      { error: getErrorMessage(error) || "Không thể tạo danh mục" },
      { status: 500 },
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const supabase = await createApiSupabaseClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json(
        { error: "Bạn chưa đăng nhập" },
        { status: 401 },
      );
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json(
        { error: "Category ID là bắt buộc" },
        { status: 400 },
      );
    }

    const { count, error: countError } = await supabase
      .from("product_categories")
      .select("id", { count: "exact", head: true })
      .eq("category_id", id);

    if (countError) throw countError;

    if ((count || 0) > 0) {
      return NextResponse.json(
        { error: "Danh mục đang được sử dụng bởi sản phẩm" },
        { status: 400 },
      );
    }

    const { error } = await supabase.from("categories").delete().eq("id", id);
    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    console.error("Error deleting category:", error);
    return NextResponse.json(
      { error: getErrorMessage(error) || "Không thể xóa danh mục" },
      { status: 500 },
    );
  }
}
