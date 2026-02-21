import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { AuditLogger } from "@/lib/auditLogger";
import type { Database } from "@/types/database";

type ProductUpdate = Database["public"]["Tables"]["products"]["Update"];
type SupabaseClient = ReturnType<typeof createServerClient>;

interface CategoryRow {
  id: string;
  name: string;
  slug: string;
}

interface ProductCategoryRelation {
  category_id: string;
  categories: CategoryRow | null;
}

type ProductWithRelations = Database["public"]["Tables"]["products"]["Row"] & {
  product_categories?: ProductCategoryRelation[];
};

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

function normalizeCategoryNames(
  categoriesInput: unknown,
  fallbackCategory?: unknown,
): string[] {
  const sourceList: unknown[] = Array.isArray(categoriesInput)
    ? categoriesInput
    : categoriesInput !== undefined && categoriesInput !== null
      ? [categoriesInput]
      : fallbackCategory !== undefined && fallbackCategory !== null
        ? [fallbackCategory]
        : [];

  const normalized = sourceList
    .map((item) => (typeof item === "string" ? item.trim() : ""))
    .filter((item) => item.length > 0);

  return Array.from(new Set(normalized));
}

async function ensureCategoryIdsByNames(
  supabase: SupabaseClient,
  categoryNames: string[],
): Promise<string[]> {
  if (categoryNames.length === 0) return [];

  const upsertPayload = categoryNames.map((name) => ({
    name,
    slug: slugify(name),
    is_active: true,
  }));

  const { error: upsertError } = await supabase
    .from("categories")
    .upsert(upsertPayload, { onConflict: "slug" });

  if (upsertError) throw upsertError;

  const slugs = upsertPayload.map((item) => item.slug);
  const { data: rows, error: selectError } = await supabase
    .from("categories")
    .select("id, slug")
    .in("slug", slugs);

  if (selectError) throw selectError;

  const idMap = new Map(
    (rows || []).map((row: { slug: string; id: string }) => [row.slug, row.id]),
  );
  return slugs
    .map((slug) => idMap.get(slug))
    .filter((id): id is string => Boolean(id));
}

async function syncProductCategoriesByName(
  supabase: SupabaseClient,
  productId: string,
  categoryNames: string[],
): Promise<void> {
  const categoryIds = await ensureCategoryIdsByNames(supabase, categoryNames);

  const { error: deleteError } = await supabase
    .from("product_categories")
    .delete()
    .eq("product_id", productId);

  if (deleteError) throw deleteError;

  if (categoryIds.length === 0) return;

  const linkPayload = categoryIds.map((categoryId) => ({
    product_id: productId,
    category_id: categoryId,
  }));

  const { error: insertError } = await supabase
    .from("product_categories")
    .insert(linkPayload);
  if (insertError) throw insertError;
}

// GET: Lấy danh sách sản phẩm
export async function GET(request: NextRequest) {
  try {
    const supabase = await createApiSupabaseClient();
    const { searchParams } = new URL(request.url);
    const activeOnly = searchParams.get("activeOnly") === "true";

    let query = supabase.from("products").select(
      `
          *,
          product_categories(
            category_id,
            categories(
              id,
              name,
              slug
            )
          )
        `,
    );

    if (activeOnly) {
      query = query.eq("is_active", true);
    }

    query = query.order("stock_quantity", { ascending: true });

    const { data: products, error } = await query;

    if (error) throw error;

    const mappedProducts = ((products || []) as ProductWithRelations[]).map(
      (product) => {
        const categories = (product.product_categories || [])
          .map((relation) => relation.categories)
          .filter((category): category is CategoryRow => Boolean(category));

        return {
          ...product,
          categories,
        };
      },
    );

    return NextResponse.json(mappedProducts);
  } catch (error) {
    console.error("Error fetching products:", error);
    return NextResponse.json(
      { error: "Failed to fetch products" },
      { status: 500 },
    );
  }
}

// POST: Tạo sản phẩm mới
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
    const {
      name,
      description,
      price,
      cost_price,
      stock_quantity,
      category,
      categories,
      image_url,
      is_active,
    } = body;

    const normalizedCategoryNames = normalizeCategoryNames(
      categories,
      category,
    );

    // Validation
    if (
      !name ||
      price === undefined ||
      price === null ||
      cost_price === undefined ||
      cost_price === null ||
      normalizedCategoryNames.length === 0
    ) {
      return NextResponse.json(
        { error: "Tên, giá bán, giá vốn và danh mục là bắt buộc" },
        { status: 400 },
      );
    }

    if (price < 0 || cost_price < 0) {
      return NextResponse.json({ error: "Giá không được âm" }, { status: 400 });
    }

    if (price < cost_price) {
      return NextResponse.json(
        { error: "Giá bán phải lớn hơn hoặc bằng giá vốn" },
        { status: 400 },
      );
    }

    if (stock_quantity && stock_quantity < 0) {
      return NextResponse.json(
        { error: "Tồn kho không được âm" },
        { status: 400 },
      );
    }

    const { data, error } = await supabase
      .from("products")
      .insert({
        name: name.trim(),
        description: description?.trim() || null,
        price,
        cost_price,
        stock_quantity: stock_quantity || 0,
        category: normalizedCategoryNames[0],
        image_url: image_url?.trim() || null,
        is_active: is_active !== undefined ? is_active : true,
      })
      .select()
      .single();

    if (error) {
      if (error.code === "42501") {
        return NextResponse.json(
          { error: "Bạn không có quyền tạo sản phẩm" },
          { status: 403 },
        );
      }
      throw error;
    }

    await syncProductCategoriesByName(
      supabase,
      data.id,
      normalizedCategoryNames,
    );

    // Log audit
    await AuditLogger.createProduct(data.id, data.name);

    return NextResponse.json({
      success: true,
      message: "Tạo sản phẩm thành công",
      product: data,
    });
  } catch (error: unknown) {
    console.error("Error creating product:", error);
    return NextResponse.json(
      { error: getErrorMessage(error) || "Không thể tạo sản phẩm" },
      { status: 500 },
    );
  }
}

// PATCH: Cập nhật sản phẩm
export async function PATCH(request: NextRequest) {
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
    const {
      id,
      name,
      description,
      price,
      cost_price,
      stock_quantity,
      category,
      categories,
      image_url,
      is_active,
    } = body;

    const normalizedCategoryNames = normalizeCategoryNames(
      categories,
      category,
    );

    if (!id) {
      return NextResponse.json(
        { error: "Product ID là bắt buộc" },
        { status: 400 },
      );
    }

    // Build update object
    const updates: ProductUpdate = {};

    if (name !== undefined) {
      if (!name.trim()) {
        return NextResponse.json(
          { error: "Tên không được rỗng" },
          { status: 400 },
        );
      }
      updates.name = name.trim();
    }

    if (description !== undefined) {
      updates.description = description?.trim() || null;
    }

    if (price !== undefined) {
      if (price < 0) {
        return NextResponse.json(
          { error: "Giá bán không được âm" },
          { status: 400 },
        );
      }
      updates.price = price;
    }

    if (cost_price !== undefined) {
      if (cost_price < 0) {
        return NextResponse.json(
          { error: "Giá vốn không được âm" },
          { status: 400 },
        );
      }
      updates.cost_price = cost_price;
    }

    let currentPrice: number | null = null;
    let currentCostPrice: number | null = null;

    if (price !== undefined || cost_price !== undefined) {
      const { data: currentProduct, error: currentProductError } =
        await supabase
          .from("products")
          .select("price, cost_price")
          .eq("id", id)
          .single();

      if (currentProductError || !currentProduct) {
        return NextResponse.json(
          { error: "Không tìm thấy sản phẩm" },
          { status: 404 },
        );
      }

      currentPrice = currentProduct.price;
      currentCostPrice = currentProduct.cost_price;
    }

    const finalPrice = price !== undefined ? price : currentPrice;
    const finalCost = cost_price !== undefined ? cost_price : currentCostPrice;

    if (
      finalPrice !== null &&
      finalCost !== null &&
      finalPrice !== undefined &&
      finalCost !== undefined &&
      finalPrice < finalCost
    ) {
      return NextResponse.json(
        { error: "Giá bán phải lớn hơn hoặc bằng giá vốn" },
        { status: 400 },
      );
    }

    if (stock_quantity !== undefined) {
      if (stock_quantity < 0) {
        return NextResponse.json(
          { error: "Tồn kho không được âm" },
          { status: 400 },
        );
      }
      updates.stock_quantity = stock_quantity;
    }

    if (category !== undefined || categories !== undefined) {
      if (normalizedCategoryNames.length === 0) {
        return NextResponse.json(
          { error: "Danh mục không được rỗng" },
          { status: 400 },
        );
      }
      updates.category = normalizedCategoryNames[0];
    }

    if (image_url !== undefined) {
      updates.image_url = image_url?.trim() || null;
    }

    if (is_active !== undefined) {
      updates.is_active = is_active;
    }

    const { data, error } = await supabase
      .from("products")
      .update(updates)
      .eq("id", id)
      .select()
      .single();

    if (error) {
      if (error.code === "42501") {
        return NextResponse.json(
          { error: "Bạn không có quyền cập nhật sản phẩm" },
          { status: 403 },
        );
      }
      throw error;
    }

    if (category !== undefined || categories !== undefined) {
      await syncProductCategoriesByName(supabase, id, normalizedCategoryNames);
    }

    // Log audit
    await AuditLogger.updateProduct(data.id, data.name);

    return NextResponse.json({
      success: true,
      message: "Cập nhật sản phẩm thành công",
      product: data,
    });
  } catch (error: unknown) {
    console.error("Error updating product:", error);
    return NextResponse.json(
      { error: getErrorMessage(error) || "Không thể cập nhật sản phẩm" },
      { status: 500 },
    );
  }
}

// DELETE: Xóa sản phẩm (soft delete)
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
        { error: "Product ID là bắt buộc" },
        { status: 400 },
      );
    }

    // Get product name first
    const { data: product } = await supabase
      .from("products")
      .select("name")
      .eq("id", id)
      .single();

    // Soft delete: set is_active = false
    const { error } = await supabase
      .from("products")
      .update({ is_active: false })
      .eq("id", id);

    if (error) {
      if (error.code === "42501") {
        return NextResponse.json(
          { error: "Bạn không có quyền xóa sản phẩm" },
          { status: 403 },
        );
      }
      throw error;
    }

    // Log audit
    if (product) {
      await AuditLogger.deleteProduct(id, product.name);
    }

    return NextResponse.json({
      success: true,
      message: "Xóa sản phẩm thành công",
    });
  } catch (error: unknown) {
    console.error("Error deleting product:", error);
    return NextResponse.json(
      { error: getErrorMessage(error) || "Không thể xóa sản phẩm" },
      { status: 500 },
    );
  }
}
