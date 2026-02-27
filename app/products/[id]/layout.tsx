import type { Metadata } from "next";
import { createClient } from "@supabase/supabase-js";
import { APP_CONFIG } from "@/lib/appConfig";

interface ProductMetadataLayoutProps {
  children: React.ReactNode;
}

interface ProductMetadataParams {
  params: { id: string };
}

interface ProductMetadataRow {
  id: string;
  name: string;
  description: string | null;
  image_url: string | null;
}

interface ProductMediaRow {
  image_url: string | null;
}

function stripHtml(input: string) {
  return input.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
}

async function getProductMetadata(id: string) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    return null;
  }

  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: productData } = await supabase
    .from("products")
    .select("id, name, description, image_url")
    .eq("id", id)
    .single();

  const product = productData as ProductMetadataRow | null;
  if (!product) return null;

  const { data: mediaRows } = await (supabase
    .from("product_images") as unknown as {
      select: (columns: string) => {
        eq: (column: string, value: string) => {
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
    })
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
  const descriptionText = stripHtml(product.description || "");
  const description = descriptionText
    ? descriptionText.slice(0, 180)
    : `${APP_CONFIG.shopTagline}.`;

  return {
    id: product.id,
    name: product.name,
    description,
    imageUrl,
  };
}

export async function generateMetadata({
  params,
}: ProductMetadataParams): Promise<Metadata> {
  const { id } = params;
  const siteUrl = APP_CONFIG.shopWebsite;
  const fallbackTitle = `${APP_CONFIG.shopName} – ${APP_CONFIG.shopTagline}`;
  const fallbackDescription = `${APP_CONFIG.shopName} – ${APP_CONFIG.shopTagline}.`;
  const canonical = `${siteUrl.replace(/\/$/, "")}/products/${id}`;
  const productMeta = await getProductMetadata(id);

  if (!productMeta) {
    return {
      title: fallbackTitle,
      description: fallbackDescription,
      alternates: { canonical },
      openGraph: {
        type: "website",
        url: canonical,
        title: fallbackTitle,
        description: fallbackDescription,
        images: [
          {
            url: "/opengraph-image",
            width: 1200,
            height: 630,
            alt: fallbackTitle,
          },
        ],
      },
      twitter: {
        card: "summary_large_image",
        title: fallbackTitle,
        description: fallbackDescription,
        images: ["/opengraph-image"],
      },
    };
  }

  const pageTitle = `${productMeta.name} | ${APP_CONFIG.shopName}`;

  return {
    title: pageTitle,
    description: productMeta.description,
    alternates: { canonical },
    openGraph: {
      type: "website",
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
          url: "/opengraph-image",
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
}: ProductMetadataLayoutProps) {
  return children;
}
