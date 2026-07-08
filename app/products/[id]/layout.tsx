import type { Metadata } from "next";
import { createClient } from "@supabase/supabase-js";
import { APP_CONFIG } from "@/lib/appConfig";
import { JsonLd } from "@/components/seo/JsonLd";
import type { Database } from "@/types/database";
import {
  DEFAULT_SEO_DESCRIPTION,
  SITE_URL,
  buildBreadcrumbJsonLd,
  buildCanonical,
  buildPageTitle,
  getDefaultSocialImage,
  stripHtml,
  toAbsoluteUrl,
  truncateDescription,
} from "@/lib/seo";
import { normalizeHtmlContent } from "@/lib/htmlContent";

interface ProductMetadataLayoutProps {
  children: React.ReactNode;
  params: Promise<{ id: string }>;
}

type ProductMetadataParams = Pick<ProductMetadataLayoutProps, "params">;

interface ProductMetadataRow {
  id: string;
  name: string;
  description: string | null;
  image_url: string | null;
  price: number;
  stock_quantity: number;
  category: string;
  price_on_request: boolean;
  is_active: boolean;
  updated_at: string;
}

interface ProductMediaRow {
  image_url: string | null;
}

async function getProductMetadata(id: string) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseKey) {
    return null;
  }

  const supabase = createClient<Database>(supabaseUrl, supabaseKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: productData, error: productError } = await supabase
    .from("products")
    .select(
      "id, name, description, image_url, price, stock_quantity, category, price_on_request, is_active, updated_at",
    )
    .eq("id", id)
    .maybeSingle();

  if (productError) {
    return null;
  }

  const product = productData as ProductMetadataRow | null;
  if (!product || !product.is_active) return null;

  const { data: mediaRows } = await (
    supabase.from("product_images") as unknown as {
      select: (columns: string) => {
        eq: (
          column: string,
          value: string,
        ) => {
          order: (
            column: string,
            options: { ascending: boolean },
          ) => {
            order: (
              column: string,
              options: { ascending: boolean },
            ) => {
              order: (
                column: string,
                options: { ascending: boolean },
              ) => {
                limit: (count: number) => Promise<{
                  data: ProductMediaRow[] | null;
                  error: unknown;
                }>;
              };
            };
          };
        };
      };
    }
  )
    .select("image_url, is_cover, display_order, created_at")
    .eq("product_id", id)
    .order("is_cover", { ascending: false })
    .order("display_order", { ascending: true })
    .order("created_at", { ascending: true })
    .limit(1);

  const mediaImageUrl = Array.isArray(mediaRows)
    ? mediaRows[0]?.image_url
    : null;
  const imageUrl = mediaImageUrl || product.image_url || "/opengraph-image";
  const descriptionText = stripHtml(normalizeHtmlContent(product.description));
  const description = truncateDescription(
    descriptionText || `${product.name} - ${APP_CONFIG.shopTagline}.`,
  );

  return {
    id: product.id,
    name: product.name,
    description,
    imageUrl: toAbsoluteUrl(imageUrl),
    price: Number(product.price || 0),
    stockQuantity: Number(product.stock_quantity || 0),
    category: product.category,
    priceOnRequest: Boolean(product.price_on_request),
    updatedAt: product.updated_at,
  };
}

type ProductSeo = NonNullable<Awaited<ReturnType<typeof getProductMetadata>>>;

function buildProductJsonLd(product: ProductSeo, canonical: string) {
  return {
    "@context": "https://schema.org",
    "@type": "Product",
    "@id": `${canonical}#product`,
    name: product.name,
    description: product.description,
    image: [product.imageUrl],
    sku: product.id,
    category: product.category,
    brand: {
      "@type": "Brand",
      name: APP_CONFIG.shopName,
    },
    url: canonical,
    dateModified: product.updatedAt,
    offers: product.priceOnRequest
      ? undefined
      : {
          "@type": "Offer",
          url: canonical,
          priceCurrency: "VND",
          price: product.price,
          availability:
            product.stockQuantity > 0
              ? "https://schema.org/InStock"
              : "https://schema.org/OutOfStock",
          itemCondition: "https://schema.org/NewCondition",
          seller: {
            "@id": `${SITE_URL}/#organization`,
            name: APP_CONFIG.shopName,
          },
        },
  };
}

export async function generateMetadata({
  params,
}: ProductMetadataParams): Promise<Metadata> {
  const { id } = await params;
  const fallbackTitle = buildPageTitle();
  const canonical = buildCanonical(`/products/${id}`);
  const productMeta = await getProductMetadata(id);

  if (!productMeta) {
    return {
      title: { absolute: fallbackTitle },
      description: DEFAULT_SEO_DESCRIPTION,
      alternates: { canonical },
      robots: {
        index: false,
        follow: false,
      },
      openGraph: {
        type: "website",
        locale: "vi_VN",
        siteName: APP_CONFIG.shopName,
        url: canonical,
        title: fallbackTitle,
        description: DEFAULT_SEO_DESCRIPTION,
        images: [getDefaultSocialImage()],
      },
      twitter: {
        card: "summary_large_image",
        title: fallbackTitle,
        description: DEFAULT_SEO_DESCRIPTION,
        images: [getDefaultSocialImage().url],
      },
    };
  }

  const pageTitle = buildPageTitle(productMeta.name);

  return {
    title: { absolute: pageTitle },
    description: productMeta.description,
    alternates: { canonical },
    openGraph: {
      type: "website",
      locale: "vi_VN",
      url: canonical,
      siteName: APP_CONFIG.shopName,
      title: pageTitle,
      description: productMeta.description,
      images: [
        {
          url: productMeta.imageUrl,
          width: 1200,
          height: 630,
          alt: productMeta.name,
        },
        {
          url: getDefaultSocialImage().url,
          width: 1200,
          height: 630,
          alt: `${APP_CONFIG.shopName} - ${APP_CONFIG.shopTagline}`,
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title: pageTitle,
      description: productMeta.description,
      images: [productMeta.imageUrl],
    },
  };
}

export default function ProductMetadataLayout({
  children,
  params,
}: ProductMetadataLayoutProps) {
  return (
    <ProductStructuredData params={params}>{children}</ProductStructuredData>
  );
}

async function ProductStructuredData({
  children,
  params,
}: ProductMetadataLayoutProps) {
  const { id } = await params;
  const productMeta = await getProductMetadata(id);

  if (!productMeta) {
    return children;
  }

  const canonical = buildCanonical(`/products/${id}`);
  const structuredData = [
    buildBreadcrumbJsonLd([
      { name: "Trang chủ", path: "/" },
      { name: "Sản phẩm", path: "/" },
      { name: productMeta.name, url: canonical },
    ]),
    buildProductJsonLd(productMeta, canonical),
  ];

  return (
    <>
      <JsonLd data={structuredData} />
      {children}
    </>
  );
}
