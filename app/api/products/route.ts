import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { AuditLogger } from "@/lib/auditLogger";
import { isAdminAuthFailure, requireAdminRole } from "@/lib/adminAuth";
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

interface ProductImageRelation {
  image_url: string;
  is_cover: boolean;
  display_order: number;
  created_at: string;
}

interface ProductVariantRow {
  id: string;
  product_id: string;
  variant_name: string;
  cost_price: number;
  price: number;
  image_url: string | null;
  sort_order: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

type ProductWithRelations = Database["public"]["Tables"]["products"]["Row"] & {
  product_categories?: ProductCategoryRelation[];
  product_images?: ProductImageRelation[];
};

type ProductListView = "public" | "admin" | "quick";
type ProductListSort =
  | "popular"
  | "newest"
  | "bestseller"
  | "price_asc"
  | "price_desc";

interface ProductImageStorageRow {
  id: string;
  storage_path: string | null;
}

function isVideoUrl(url: string): boolean {
  return /\.(mp4|webm|mov|m4v)(\?|#|$)/i.test(url);
}

function resolveProductImageUrl(product: ProductWithRelations): string | null {
  const mediaList = (product.product_images || []).filter(
    (item) => item.image_url && !isVideoUrl(item.image_url),
  );

  const coverImage = mediaList.find((item) => item.is_cover);
  if (coverImage?.image_url) return coverImage.image_url;

  if (mediaList.length > 0) {
    const sorted = [...mediaList].sort((first, second) => {
      if (first.display_order !== second.display_order) {
        return first.display_order - second.display_order;
      }
      return (
        new Date(first.created_at).getTime() -
        new Date(second.created_at).getTime()
      );
    });
    return sorted[0]?.image_url || null;
  }

  return product.image_url;
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  return "Đã xảy ra lỗi";
}

function toOptionalNumber(value: unknown): number | null {
  if (value === undefined || value === null || value === "") {
    return null;
  }

  const parsed =
    typeof value === "number"
      ? value
      : typeof value === "string"
        ? Number(value)
        : NaN;

  return Number.isFinite(parsed) ? parsed : null;
}

function parseOptionalTimestamp(value: unknown): {
  value: string | null;
  invalid: boolean;
} {
  if (value === undefined || value === null || value === "") {
    return { value: null, invalid: false };
  }

  const parsed = new Date(String(value));
  if (Number.isNaN(parsed.getTime())) {
    return { value: null, invalid: true };
  }

  return { value: parsed.toISOString(), invalid: false };
}

function parsePositiveInteger(
  value: string | null,
  fallback: number,
  maximum: number,
): number {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) return fallback;
  return Math.min(parsed, maximum);
}

function normalizeSearchTerm(value: string | null): string {
  return String(value || "")
    .trim()
    .replace(/[^\p{L}\p{N}\s-]/gu, " ")
    .replace(/\s+/g, " ")
    .slice(0, 120);
}

function getCategoryList(product: ProductWithRelations): CategoryRow[] {
  return (product.product_categories || [])
    .map((relation) => relation.categories)
    .filter((category): category is CategoryRow => Boolean(category))
    .filter(
      (category, index, list) =>
        list.findIndex((item) => item.id === category.id) === index,
    );
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

function createPublicSupabaseClient() {
  return createClient<Database>(
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

function createServiceRoleSupabaseClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    return null;
  }

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

async function clearExpiredProductDiscounts() {
  const serviceRoleClient = createServiceRoleSupabaseClient();
  if (!serviceRoleClient) return;

  const nowIso = new Date().toISOString();

  type ProductsUpdateQuery = {
    gt: (column: string, value: number) => ProductsUpdateQuery;
    not: (
      column: string,
      operator: string,
      value: string | null,
    ) => ProductsUpdateQuery;
    lte: (column: string, value: string) => Promise<{ error: unknown }>;
  };

  const productsUpdateApi = serviceRoleClient.from("products") as unknown as {
    update: (values: {
      discount_percent: number;
      discount_start_at: null;
      discount_end_at: null;
    }) => ProductsUpdateQuery;
  };

  const { error } = await productsUpdateApi
    .update({
      discount_percent: 0,
      discount_start_at: null,
      discount_end_at: null,
    })
    .gt("discount_percent", 0)
    .not("discount_end_at", "is", null)
    .lte("discount_end_at", nowIso);

  if (error) {
    console.error("Error clearing expired product discounts:", error);
  }
}

const DISCOUNT_CLEANUP_INTERVAL_MS = 5 * 60 * 1000;
let discountCleanupLastRunAt = 0;
let discountCleanupInFlight: Promise<void> | null = null;

function scheduleExpiredDiscountCleanup() {
  const now = Date.now();

  if (discountCleanupInFlight) {
    return;
  }

  if (now - discountCleanupLastRunAt < DISCOUNT_CLEANUP_INTERVAL_MS) {
    return;
  }

  discountCleanupLastRunAt = now;
  discountCleanupInFlight = clearExpiredProductDiscounts()
    .catch((error) => {
      console.error("Error during scheduled discount cleanup:", error);
      discountCleanupLastRunAt = 0;
    })
    .finally(() => {
      discountCleanupInFlight = null;
    });
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

  const slugToName = new Map<string, string>();

  normalized.forEach((name) => {
    const slug = slugify(name);
    if (!slug) return;

    if (!slugToName.has(slug)) {
      slugToName.set(slug, name);
    }
  });

  return Array.from(slugToName.values());
}

async function ensureCategoryIdsByNames(
  supabase: SupabaseClient,
  categoryNames: string[],
): Promise<string[]> {
  if (categoryNames.length === 0) return [];

  const slugToName = new Map<string, string>();
  categoryNames.forEach((name) => {
    const slug = slugify(name);
    if (!slug) return;
    if (!slugToName.has(slug)) {
      slugToName.set(slug, name);
    }
  });

  const requestedEntries = Array.from(slugToName.entries());
  if (requestedEntries.length === 0) return [];

  const { data: existingRows, error: existingRowsError } = await supabase
    .from("categories")
    .select("id, name, slug");

  if (existingRowsError) throw existingRowsError;

  const existingRowsByNameKey = new Map<
    string,
    { id: string; slug: string }
  >();
  (existingRows || []).forEach(
    (row: { id: string; name: string; slug: string }) => {
      const nameKey = slugify(row.name);
      if (!nameKey) return;

      const current = existingRowsByNameKey.get(nameKey);
      if (!current || row.slug === nameKey) {
        existingRowsByNameKey.set(nameKey, {
          id: row.id,
          slug: row.slug,
        });
      }
    },
  );

  const missingCategories = requestedEntries
    .filter(([nameKey]) => !existingRowsByNameKey.has(nameKey))
    .map(([slug, name]) => ({
      name,
      slug,
      is_active: true,
    }));

  if (missingCategories.length > 0) {
    const { data: insertedRows, error: insertError } = await supabase
      .from("categories")
      .upsert(missingCategories, { onConflict: "slug" })
      .select("id, name, slug");

    if (insertError) throw insertError;

    (insertedRows || []).forEach(
      (row: { id: string; name: string; slug: string }) => {
        existingRowsByNameKey.set(slugify(row.name), {
          id: row.id,
          slug: row.slug,
        });
      },
    );
  }

  return requestedEntries
    .map(([nameKey]) => existingRowsByNameKey.get(nameKey)?.id)
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

function normalizeVariantItems(input: unknown): Array<{
  variant_name: string;
  cost_price: number;
  price: number;
  image_url: string | null;
  sort_order: number;
  is_active: boolean;
}> {
  if (!Array.isArray(input)) return [];

  return input
    .map((item, index) => {
      const source = item as Record<string, unknown>;
      const variantName = String(
        source.variant_name || source.name || "",
      ).trim();
      const normalizedCostPrice = toOptionalNumber(source.cost_price);
      const normalizedPrice = toOptionalNumber(source.price);
      const imageUrlRaw = String(
        source.image_url || source.imageUrl || "",
      ).trim();
      const sortOrderRaw = toOptionalNumber(source.sort_order);

      if (
        !variantName ||
        normalizedCostPrice === null ||
        normalizedCostPrice < 0 ||
        normalizedPrice === null ||
        normalizedPrice < 0 ||
        normalizedPrice < normalizedCostPrice
      ) {
        return null;
      }

      return {
        variant_name: variantName,
        cost_price: normalizedCostPrice,
        price: normalizedPrice,
        image_url: imageUrlRaw || null,
        sort_order:
          sortOrderRaw !== null && sortOrderRaw > 0
            ? Math.trunc(sortOrderRaw)
            : index + 1,
        is_active: source.is_active !== false,
      };
    })
    .filter(
      (
        item,
      ): item is {
        variant_name: string;
        cost_price: number;
        price: number;
        image_url: string | null;
        sort_order: number;
        is_active: boolean;
      } => Boolean(item),
    );
}

async function syncProductVariants(
  supabase: SupabaseClient,
  productId: string,
  variants: Array<{
    variant_name: string;
    cost_price: number;
    price: number;
    image_url: string | null;
    sort_order: number;
    is_active: boolean;
  }>,
): Promise<void> {
  const { error: deleteError } = await supabase
    .from("product_variants")
    .delete()
    .eq("product_id", productId);
  if (deleteError) throw deleteError;

  if (variants.length === 0) return;

  const payload = variants.map((item) => ({
    product_id: productId,
    variant_name: item.variant_name,
    cost_price: item.cost_price,
    price: item.price,
    image_url: item.image_url,
    sort_order: item.sort_order,
    is_active: item.is_active,
  }));

  const { error: insertError } = await supabase
    .from("product_variants")
    .insert(payload);
  if (insertError) throw insertError;
}

// GET: Lấy danh sách sản phẩm
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const usePagination =
      searchParams.get("paginated") === "1" ||
      searchParams.get("paginated") === "true";
    const view = (["public", "admin", "quick"].includes(
      searchParams.get("view") || "",
    )
      ? searchParams.get("view")
      : "public") as ProductListView;

    if (usePagination && view === "admin") {
      const auth = await requireAdminRole();
      if (isAdminAuthFailure(auth)) return auth.response;
    }

    const supabase = usePagination
      ? await createApiSupabaseClient()
      : createPublicSupabaseClient();
    scheduleExpiredDiscountCleanup();
    const activeOnly = searchParams.get("activeOnly") === "true";
    const noCache =
      searchParams.get("noCache") === "1" ||
      searchParams.get("noCache") === "true";

    if (usePagination) {
      const page = parsePositiveInteger(searchParams.get("page"), 1, 100000);
      const defaultPageSize = view === "quick" ? 30 : 24;
      const pageSize = parsePositiveInteger(
        searchParams.get("pageSize"),
        defaultPageSize,
        100,
      );
      const search = normalizeSearchTerm(searchParams.get("search"));
      const category = String(searchParams.get("category") || "").trim();
      const status = String(searchParams.get("status") || "all");
      const inStock = searchParams.get("inStock") === "true";
      const discounted = searchParams.get("discounted") === "true";
      const includeFacets = searchParams.get("includeFacets") === "true";
      const includeStats = view === "admin" &&
        searchParams.get("includeStats") === "true";
      const requestedSort = String(
        searchParams.get("sort") || "popular",
      ) as ProductListSort;
      const sort: ProductListSort = [
        "popular",
        "newest",
        "bestseller",
        "price_asc",
        "price_desc",
      ].includes(requestedSort)
        ? requestedSort
        : "popular";

      let categoryProductIds: string[] | null = null;
      if (category && category !== "all") {
        const { data: categoryRows, error: categoryError } = await supabase
          .from("categories")
          .select("id")
          .eq("name", category);
        if (categoryError) throw categoryError;

        const categoryIds = (categoryRows || []).map((item) => item.id);
        if (categoryIds.length === 0) {
          categoryProductIds = [];
        } else {
          const { data: categoryLinks, error: categoryLinksError } =
            await supabase
              .from("product_categories")
              .select("product_id")
              .in("category_id", categoryIds);
          if (categoryLinksError) throw categoryLinksError;
          categoryProductIds = Array.from(
            new Set((categoryLinks || []).map((item) => item.product_id)),
          );
        }
      }

      const managementFields =
        view === "admin" ? "description, cost_price," : "";
      const listSelect = `
        id,
        name,
        price,
        ${managementFields}
        stock_quantity,
        category,
        image_url,
        discount_percent,
        discount_start_at,
        discount_end_at,
        price_on_request,
        is_active,
        created_at,
        updated_at,
        product_categories(
          category_id,
          categories(
            id,
            name,
            slug
          )
        )
      `;

      let query = supabase
        .from("products")
        .select(listSelect, { count: "exact" });

      if (activeOnly || view !== "admin" || status === "active") {
        query = query.eq("is_active", true);
      } else if (status === "inactive") {
        query = query.eq("is_active", false);
      }

      if (status === "low-stock") {
        query = query.eq("is_active", true).lt("stock_quantity", 10);
      }
      if (inStock) {
        query = query.gt("stock_quantity", 0);
      }
      if (discounted) {
        const now = new Date().toISOString();
        query = query
          .gt("discount_percent", 0)
          .lte("discount_start_at", now)
          .gte("discount_end_at", now);
      }
      if (search) {
        query = query.or(
          `name.ilike.%${search}%,description.ilike.%${search}%,category.ilike.%${search}%`,
        );
      }
      if (categoryProductIds) {
        if (categoryProductIds.length === 0) {
          query = query.eq(
            "id",
            "00000000-0000-0000-0000-000000000000",
          );
        } else {
          query = query.in("id", categoryProductIds);
        }
      }

      if (sort === "price_asc" || sort === "price_desc") {
        query = query.order("price", {
          ascending: sort === "price_asc",
        });
      } else if (sort === "newest") {
        query = query.order("created_at", { ascending: false });
      } else if (sort === "bestseller") {
        query = query
          .order("stock_quantity", { ascending: true })
          .order("discount_percent", { ascending: false });
      } else {
        query = query.order("updated_at", { ascending: false });
      }

      const from = (page - 1) * pageSize;
      const to = from + pageSize - 1;
      const { data: rows, error, count } = await query
        .order("id", { ascending: true })
        .range(from, to);
      if (error) throw error;

      const items = ((rows || []) as unknown as ProductWithRelations[]).map(
        (product) => ({
          ...product,
          categories: getCategoryList(product),
        }),
      );

      let categoryFacets: Array<{ name: string; count: number }> = [];
      if (includeFacets) {
        let facetQuery = supabase
          .from("products")
          .select("category")
          .not("category", "is", null);
        if (view !== "admin" || activeOnly) {
          facetQuery = facetQuery.eq("is_active", true);
        }

        const { data: facetRows, error: facetError } = await facetQuery;
        if (facetError) throw facetError;

        const categoryCounts = new Map<string, number>();
        (facetRows || []).forEach((item) => {
          const name = String(item.category || "").trim();
          if (!name) return;
          categoryCounts.set(name, (categoryCounts.get(name) || 0) + 1);
        });
        categoryFacets = Array.from(categoryCounts.entries())
          .sort((first, second) => first[0].localeCompare(second[0], "vi"))
          .map(([name, categoryCount]) => ({
            name,
            count: categoryCount,
          }));
      }

      let stats:
        | {
            total: number;
            active: number;
            lowStock: number;
            totalValue: number;
            categoryCount: number;
          }
        | undefined;
      if (includeStats) {
        const { data: statRows, error: statError } = await supabase
          .from("products")
          .select("price, stock_quantity, is_active, category");
        if (statError) throw statError;

        const allProducts = statRows || [];
        stats = {
          total: allProducts.length,
          active: allProducts.filter((item) => item.is_active).length,
          lowStock: allProducts.filter(
            (item) => item.is_active && item.stock_quantity < 10,
          ).length,
          totalValue: allProducts.reduce(
            (sum, item) =>
              sum + Number(item.price || 0) * Number(item.stock_quantity || 0),
            0,
          ),
          categoryCount: new Set(
            allProducts
              .map((item) => String(item.category || "").trim())
              .filter(Boolean),
          ).size,
        };
      }

      const total = count || 0;
      return NextResponse.json(
        {
          items,
          total,
          page,
          pageSize,
          totalPages: Math.ceil(total / pageSize),
          facets: { categories: categoryFacets },
          stats,
        },
        {
          headers: {
            "Cache-Control":
              view === "public" && !noCache
                ? "public, max-age=60, stale-while-revalidate=300"
                : "no-store",
          },
        },
      );
    }

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
          ),
          product_images(
            image_url,
            is_cover,
            display_order,
            created_at
          )
        `,
    );

    if (activeOnly) {
      query = query.eq("is_active", true);
    }

    query = query.order("stock_quantity", { ascending: true });

    const { data: products, error } = await query;

    if (error) throw error;

    const productList = (products || []) as ProductWithRelations[];
    const productIds = productList.map((item) => item.id);
    let variantRows: ProductVariantRow[] = [];

    if (productIds.length > 0) {
      const { data: variantsData } = await supabase
        .from("product_variants")
        .select(
          "id, product_id, variant_name, cost_price, price, image_url, sort_order, is_active, created_at, updated_at",
        )
        .in("product_id", productIds)
        .order("sort_order", { ascending: true })
        .order("created_at", { ascending: true });
      variantRows = (variantsData || []) as ProductVariantRow[];
    }

    const variantMap = new Map<string, ProductVariantRow[]>();
    variantRows.forEach((item) => {
      const current = variantMap.get(item.product_id) || [];
      current.push(item);
      variantMap.set(item.product_id, current);
    });

    const mappedProducts = productList.map((product) => {
      const categories = getCategoryList(product);

      return {
        ...product,
        image_url: resolveProductImageUrl(product),
        categories,
        variants: (variantMap.get(product.id) || []).filter(
          (variant) => variant.is_active,
        ),
      };
    });

    return NextResponse.json(mappedProducts, {
      headers: {
        "Cache-Control": noCache
          ? "no-store"
          : "public, max-age=60, stale-while-revalidate=300",
      },
    });
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
    const auth = await requireAdminRole();
    if (isAdminAuthFailure(auth)) return auth.response;

    const supabase = await createApiSupabaseClient();

    const body = await request.json();
    const {
      name,
      description,
      price,
      discount_percent,
      discount_start_at,
      discount_end_at,
      cost_price,
      stock_quantity,
      category,
      categories,
      variants,
      price_on_request,
      is_active,
    } = body;

    const normalizedCategoryNames = normalizeCategoryNames(
      categories,
      category,
    );
    const normalizedVariants = normalizeVariantItems(variants);
    const normalizedPrice = toOptionalNumber(price);
    const normalizedCostPrice = toOptionalNumber(cost_price);
    const normalizedStockQuantity = toOptionalNumber(stock_quantity);
    const normalizedDiscountPercent = toOptionalNumber(discount_percent);
    const {
      value: normalizedDiscountStartAt,
      invalid: invalidDiscountStartAt,
    } = parseOptionalTimestamp(discount_start_at);
    const { value: normalizedDiscountEndAt, invalid: invalidDiscountEndAt } =
      parseOptionalTimestamp(discount_end_at);

    // Validation
    const effectiveCreatePrice =
      normalizedVariants.length > 0
        ? normalizedVariants[0].price
        : normalizedPrice;
    const effectiveCreateCost =
      normalizedVariants.length > 0
        ? normalizedVariants[0].cost_price
        : normalizedCostPrice;

    if (
      !name ||
      effectiveCreatePrice === null ||
      effectiveCreateCost === null ||
      normalizedCategoryNames.length === 0
    ) {
      return NextResponse.json(
        { error: "Tên, giá bán, giá vốn và danh mục là bắt buộc" },
        { status: 400 },
      );
    }

    if (effectiveCreatePrice < 0 || effectiveCreateCost < 0) {
      return NextResponse.json({ error: "Giá không được âm" }, { status: 400 });
    }

    if (
      normalizedDiscountPercent !== null &&
      (normalizedDiscountPercent < 0 || normalizedDiscountPercent > 100)
    ) {
      return NextResponse.json(
        { error: "Giảm giá phải nằm trong khoảng 0-100%" },
        { status: 400 },
      );
    }

    if (invalidDiscountStartAt || invalidDiscountEndAt) {
      return NextResponse.json(
        { error: "Thời gian hiệu lực giảm giá không hợp lệ" },
        { status: 400 },
      );
    }

    const finalDiscountPercent =
      normalizedDiscountPercent !== null ? normalizedDiscountPercent : 0;

    if (finalDiscountPercent > 0) {
      if (!normalizedDiscountStartAt || !normalizedDiscountEndAt) {
        return NextResponse.json(
          {
            error:
              "Vui lòng chọn đầy đủ thời gian bắt đầu và kết thúc khi thiết lập giảm giá",
          },
          { status: 400 },
        );
      }

      if (
        new Date(normalizedDiscountEndAt).getTime() <=
        new Date(normalizedDiscountStartAt).getTime()
      ) {
        return NextResponse.json(
          { error: "Thời gian kết thúc giảm giá phải sau thời gian bắt đầu" },
          { status: 400 },
        );
      }
    }

    if (effectiveCreatePrice < effectiveCreateCost) {
      return NextResponse.json(
        { error: "Giá bán phải lớn hơn hoặc bằng giá vốn" },
        { status: 400 },
      );
    }

    if (normalizedStockQuantity !== null && normalizedStockQuantity < 0) {
      return NextResponse.json(
        { error: "Tồn kho không được âm" },
        { status: 400 },
      );
    }

    if (
      normalizedStockQuantity !== null &&
      !Number.isInteger(normalizedStockQuantity)
    ) {
      return NextResponse.json(
        { error: "Tồn kho phải là số nguyên" },
        { status: 400 },
      );
    }

    const basePriceFromVariant =
      normalizedVariants.length > 0 ? normalizedVariants[0].price : null;
    const baseCostFromVariant =
      normalizedVariants.length > 0 ? normalizedVariants[0].cost_price : null;

    const { data, error } = await supabase
      .from("products")
      .insert({
        name: name.trim(),
        description: description?.trim() || null,
        price: basePriceFromVariant ?? effectiveCreatePrice,
        discount_percent: finalDiscountPercent,
        discount_start_at:
          finalDiscountPercent > 0 ? normalizedDiscountStartAt : null,
        discount_end_at:
          finalDiscountPercent > 0 ? normalizedDiscountEndAt : null,
        cost_price: baseCostFromVariant ?? effectiveCreateCost,
        stock_quantity: 0,
        category: normalizedCategoryNames[0],
        image_url: null,
        price_on_request: price_on_request === true,
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
    await syncProductVariants(supabase, data.id, normalizedVariants);

    const initialStockQuantity = normalizedStockQuantity ?? 0;
    if (initialStockQuantity > 0) {
      const { error: inboundError } = await supabase.rpc(
        "process_stock_inbound",
        {
          p_product_id: data.id,
          p_quantity_added: initialStockQuantity,
          p_cost_price_at_time: effectiveCreateCost,
          p_supplier: "Tạo mới sản phẩm",
          p_notes: "Tồn kho ban đầu khi tạo sản phẩm",
        },
      );

      if (inboundError) throw inboundError;

      await AuditLogger.stockInbound(
        data.id,
        data.name,
        initialStockQuantity,
        effectiveCreateCost,
        "Tạo mới sản phẩm",
      );
    }

    // Log audit
    await AuditLogger.createProduct(data.id, data.name);

    return NextResponse.json({
      success: true,
      message: "Tạo sản phẩm thành công",
      product: {
        ...data,
        stock_quantity: initialStockQuantity,
      },
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
    const auth = await requireAdminRole();
    if (isAdminAuthFailure(auth)) return auth.response;

    const supabase = await createApiSupabaseClient();

    const body = await request.json();
    const {
      id,
      name,
      description,
      price,
      discount_percent,
      discount_start_at,
      discount_end_at,
      cost_price,
      stock_quantity,
      category,
      categories,
      variants,
      price_on_request,
      is_active,
    } = body;

    const normalizedCategoryNames = normalizeCategoryNames(
      categories,
      category,
    );
    const normalizedVariants = normalizeVariantItems(variants);
    const normalizedPrice = toOptionalNumber(price);
    const normalizedCostPrice = toOptionalNumber(cost_price);
    const normalizedStockQuantity = toOptionalNumber(stock_quantity);
    const normalizedDiscountPercent = toOptionalNumber(discount_percent);
    const {
      value: normalizedDiscountStartAt,
      invalid: invalidDiscountStartAt,
    } = parseOptionalTimestamp(discount_start_at);
    const { value: normalizedDiscountEndAt, invalid: invalidDiscountEndAt } =
      parseOptionalTimestamp(discount_end_at);
    const hasDiscountStartAt = Object.prototype.hasOwnProperty.call(
      body,
      "discount_start_at",
    );
    const hasDiscountEndAt = Object.prototype.hasOwnProperty.call(
      body,
      "discount_end_at",
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
      if (normalizedPrice === null || normalizedPrice < 0) {
        return NextResponse.json(
          { error: "Giá bán không được âm" },
          { status: 400 },
        );
      }
      updates.price = normalizedPrice;
    }

    if (variants !== undefined && normalizedVariants.length > 0) {
      updates.price = normalizedVariants[0].price;
      updates.cost_price = normalizedVariants[0].cost_price;
    }

    if (discount_percent !== undefined) {
      if (
        normalizedDiscountPercent === null ||
        normalizedDiscountPercent < 0 ||
        normalizedDiscountPercent > 100
      ) {
        return NextResponse.json(
          { error: "Giảm giá phải nằm trong khoảng 0-100%" },
          { status: 400 },
        );
      }
      updates.discount_percent = normalizedDiscountPercent;
    }

    if (invalidDiscountStartAt || invalidDiscountEndAt) {
      return NextResponse.json(
        { error: "Thời gian hiệu lực giảm giá không hợp lệ" },
        { status: 400 },
      );
    }

    if (hasDiscountStartAt) {
      updates.discount_start_at = normalizedDiscountStartAt;
    }

    if (hasDiscountEndAt) {
      updates.discount_end_at = normalizedDiscountEndAt;
    }

    if (cost_price !== undefined) {
      if (normalizedCostPrice === null || normalizedCostPrice < 0) {
        return NextResponse.json(
          { error: "Giá vốn không được âm" },
          { status: 400 },
        );
      }
      updates.cost_price = normalizedCostPrice;
    }

    let currentPrice: number | null = null;
    let currentCostPrice: number | null = null;
    let currentDiscountPercent: number | null = null;
    let currentDiscountStartAt: string | null = null;
    let currentDiscountEndAt: string | null = null;

    const hasDiscountChanges =
      discount_percent !== undefined || hasDiscountStartAt || hasDiscountEndAt;

    if (price !== undefined || cost_price !== undefined || hasDiscountChanges) {
      const { data: currentProduct, error: currentProductError } =
        await supabase
          .from("products")
          .select(
            "price, cost_price, discount_percent, discount_start_at, discount_end_at",
          )
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
      currentDiscountPercent = Number(currentProduct.discount_percent || 0);
      currentDiscountStartAt = currentProduct.discount_start_at || null;
      currentDiscountEndAt = currentProduct.discount_end_at || null;
    }

    const finalPrice =
      variants !== undefined && normalizedVariants.length > 0
        ? normalizedVariants[0].price
        : price !== undefined
          ? normalizedPrice
          : currentPrice;
    const finalCost =
      variants !== undefined && normalizedVariants.length > 0
        ? normalizedVariants[0].cost_price
        : cost_price !== undefined
          ? normalizedCostPrice
          : currentCostPrice;

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

    const finalDiscountPercent =
      discount_percent !== undefined
        ? normalizedDiscountPercent
        : currentDiscountPercent;
    const finalDiscountStartAt = hasDiscountStartAt
      ? normalizedDiscountStartAt
      : currentDiscountStartAt;
    const finalDiscountEndAt = hasDiscountEndAt
      ? normalizedDiscountEndAt
      : currentDiscountEndAt;

    if (
      finalDiscountPercent !== null &&
      finalDiscountPercent !== undefined &&
      finalDiscountPercent > 0
    ) {
      if (!finalDiscountStartAt || !finalDiscountEndAt) {
        return NextResponse.json(
          {
            error:
              "Vui lòng chọn đầy đủ thời gian bắt đầu và kết thúc khi thiết lập giảm giá",
          },
          { status: 400 },
        );
      }

      if (
        new Date(finalDiscountEndAt).getTime() <=
        new Date(finalDiscountStartAt).getTime()
      ) {
        return NextResponse.json(
          { error: "Thời gian kết thúc giảm giá phải sau thời gian bắt đầu" },
          { status: 400 },
        );
      }
    }

    if (
      discount_percent !== undefined &&
      Number(normalizedDiscountPercent || 0) <= 0
    ) {
      updates.discount_start_at = null;
      updates.discount_end_at = null;
    }

    if (stock_quantity !== undefined) {
      if (normalizedStockQuantity === null || normalizedStockQuantity < 0) {
        return NextResponse.json(
          { error: "Tồn kho không được âm" },
          { status: 400 },
        );
      }
      updates.stock_quantity = normalizedStockQuantity;
    }

    if (price_on_request !== undefined) {
      updates.price_on_request = price_on_request === true;
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
    if (variants !== undefined) {
      await syncProductVariants(supabase, id, normalizedVariants);
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
    const auth = await requireAdminRole();
    if (isAdminAuthFailure(auth)) return auth.response;

    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json(
        { error: "Product ID là bắt buộc" },
        { status: 400 },
      );
    }

    const serviceRoleClient = createServiceRoleSupabaseClient();
    if (!serviceRoleClient) {
      return NextResponse.json(
        { error: "Thiếu cấu hình SUPABASE_SERVICE_ROLE_KEY" },
        { status: 500 },
      );
    }
    const mutationClient = serviceRoleClient;

    const { data: productData, error: productError } = await mutationClient
      .from("products")
      .select("id, name, is_active")
      .eq("id", id)
      .single();

    if (productError) {
      if ((productError as { code?: string }).code === "PGRST116") {
        return NextResponse.json(
          { error: "Không tìm thấy sản phẩm" },
          { status: 404 },
        );
      }
      throw productError;
    }

    const product = productData as {
      id: string;
      name: string;
      is_active: boolean;
    } | null;

    if (!product) {
      return NextResponse.json(
        { error: "Không tìm thấy sản phẩm" },
        { status: 404 },
      );
    }

    if (!product.is_active) {
      return NextResponse.json({
        success: true,
        message: "Sản phẩm đã được ẩn trước đó",
      });
    }

    const { data: mediaRows, error: mediaRowsError } = await mutationClient
      .from("product_images")
      .select("id, storage_path")
      .eq("product_id", id);

    if (mediaRowsError) {
      throw mediaRowsError;
    }

    const mediaList = Array.isArray(mediaRows)
      ? (mediaRows as ProductImageStorageRow[])
      : [];
    const storagePaths = mediaList
      .map((item) => item.storage_path)
      .filter(
        (path): path is string =>
          Boolean(path) && String(path).startsWith("products/"),
      );

    if (storagePaths.length > 0 && serviceRoleClient) {
      const { error: removeStorageError } = await serviceRoleClient.storage
        .from("product-images")
        .remove(storagePaths);

      if (removeStorageError) {
        console.error(
          "Error removing product media from storage during product delete:",
          removeStorageError,
        );
      }
    }

    const { error: deleteMediaError } = await mutationClient
      .from("product_images")
      .delete()
      .eq("product_id", id);

    if (deleteMediaError) {
      throw deleteMediaError;
    }

    const { data: updatedProduct, error: updateError } = await mutationClient
      .from("products")
      .update({
        is_active: false,
        image_url: null,
      } satisfies ProductUpdate)
      .eq("id", id)
      .select("id")
      .maybeSingle();

    if (updateError) {
      if ((updateError as { code?: string }).code === "42501") {
        return NextResponse.json(
          { error: "Bạn không có quyền xóa sản phẩm" },
          { status: 403 },
        );
      }
      throw updateError;
    }

    if (!updatedProduct) {
      return NextResponse.json(
        { error: "Không thể xóa sản phẩm do thiếu quyền cập nhật" },
        { status: 403 },
      );
    }

    // Log audit
    await AuditLogger.deleteProduct(id, product.name);

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
