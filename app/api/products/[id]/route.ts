import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

interface CategoryRow {
  id: string;
  name: string;
  slug: string;
}

interface CategoryRelation {
  categories: CategoryRow | null;
}

interface ProductImageRow {
  id: string;
  image_url: string;
  display_order: number;
  is_cover: boolean;
  width: number | null;
  height: number | null;
  created_at: string;
}

interface ProductDetailRow {
  id: string;
  name: string;
  description: string | null;
  price: number;
  stock_quantity: number;
  category: string;
  image_url: string | null;
  discount_percent: number | null;
  discount_start_at: string | null;
  discount_end_at: string | null;
  price_on_request: boolean;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  product_categories?: CategoryRelation[];
  product_images?: ProductImageRow[];
  product_variants?: Array<{
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
  }>;
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

function getCategories(relations?: CategoryRelation[]): CategoryRow[] {
  return (relations || [])
    .map((relation) => relation.categories)
    .filter((category): category is CategoryRow => Boolean(category))
    .filter(
      (category, index, list) =>
        list.findIndex((item) => item.id === category.id) === index,
    );
}

function getCoverImage(
  fallback: string | null,
  images?: ProductImageRow[],
): string | null {
  const imageList = images || [];
  const cover = imageList.find((item) => item.is_cover);
  if (cover?.image_url) return cover.image_url;

  const firstImage = [...imageList].sort((first, second) => {
    if (first.display_order !== second.display_order) {
      return first.display_order - second.display_order;
    }
    return (
      new Date(first.created_at).getTime() -
      new Date(second.created_at).getTime()
    );
  })[0];

  return firstImage?.image_url || fallback;
}

function detectMediaType(url: string): "image" | "video" {
  return /\.(mp4|webm|mov|m4v)(\?|#|$)/i.test(url) ? "video" : "image";
}

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await context.params;
    if (!id) {
      return NextResponse.json(
        { error: "Product ID là bắt buộc" },
        { status: 400 },
      );
    }

    const supabase = await createApiSupabaseClient();
    const { data, error } = await supabase
      .from("products")
      .select(
        `
          id,
          name,
          description,
          price,
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
            categories(id, name, slug)
          ),
          product_images(
            id,
            image_url,
            display_order,
            is_cover,
            width,
            height,
            created_at
          ),
          product_variants(
            id,
            product_id,
            variant_name,
            cost_price,
            price,
            image_url,
            sort_order,
            is_active,
            created_at,
            updated_at
          )
        `,
      )
      .eq("id", id)
      .eq("is_active", true)
      .single();

    if (error || !data) {
      return NextResponse.json(
        { error: "Không tìm thấy sản phẩm" },
        { status: 404 },
      );
    }

    const productRow = data as unknown as ProductDetailRow;
    const media = [...(productRow.product_images || [])]
      .sort((first, second) => {
        if (first.is_cover !== second.is_cover) {
          return first.is_cover ? -1 : 1;
        }
        if (first.display_order !== second.display_order) {
          return first.display_order - second.display_order;
        }
        return (
          new Date(first.created_at).getTime() -
          new Date(second.created_at).getTime()
        );
      })
      .map((item) => ({
        id: item.id,
        image_url: item.image_url,
        display_order: item.display_order,
        is_cover: item.is_cover,
        width: item.width,
        height: item.height,
        media_type: detectMediaType(item.image_url),
      }));

    const product = {
      id: productRow.id,
      name: productRow.name,
      description: productRow.description,
      price: productRow.price,
      stock_quantity: productRow.stock_quantity,
      category: productRow.category,
      image_url: getCoverImage(
        productRow.image_url,
        productRow.product_images,
      ),
      discount_percent: productRow.discount_percent,
      discount_start_at: productRow.discount_start_at,
      discount_end_at: productRow.discount_end_at,
      price_on_request: productRow.price_on_request,
      is_active: productRow.is_active,
      created_at: productRow.created_at,
      updated_at: productRow.updated_at,
      categories: getCategories(productRow.product_categories),
      variants: (productRow.product_variants || [])
        .filter((variant) => variant.is_active)
        .sort((first, second) => first.sort_order - second.sort_order),
    };

    const { data: relatedRows, error: relatedError } = await supabase
      .from("products")
      .select(
        `
          id,
          name,
          description,
          price,
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
            categories(id, name, slug)
          )
        `,
      )
      .eq("is_active", true)
      .eq("category", productRow.category)
      .neq("id", productRow.id)
      .order("updated_at", { ascending: false })
      .limit(4);

    if (relatedError) throw relatedError;

    const relatedProducts = ((relatedRows || []) as unknown as ProductDetailRow[])
      .map((item) => ({
        id: item.id,
        name: item.name,
        description: item.description,
        price: item.price,
        stock_quantity: item.stock_quantity,
        category: item.category,
        image_url: item.image_url,
        discount_percent: item.discount_percent,
        discount_start_at: item.discount_start_at,
        discount_end_at: item.discount_end_at,
        price_on_request: item.price_on_request,
        is_active: item.is_active,
        created_at: item.created_at,
        updated_at: item.updated_at,
        categories: getCategories(item.product_categories),
      }));

    return NextResponse.json(
      { product, relatedProducts, media },
      {
        headers: {
          "Cache-Control": "public, max-age=60, stale-while-revalidate=300",
        },
      },
    );
  } catch (error) {
    console.error("Error fetching product detail:", error);
    return NextResponse.json(
      { error: "Không thể tải chi tiết sản phẩm" },
      { status: 500 },
    );
  }
}
