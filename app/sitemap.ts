import type { MetadataRoute } from "next";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import { buildCanonical } from "@/lib/seo";

interface SitemapProductRow {
  id: string;
  updated_at: string;
}

interface SitemapArticleRow {
  slug: string;
  updated_at: string;
  published_at: string | null;
}

const staticRoutes: MetadataRoute.Sitemap = [
  {
    url: buildCanonical("/"),
    lastModified: new Date(),
    changeFrequency: "daily",
    priority: 1,
  },
  {
    url: buildCanonical("/nutrition"),
    lastModified: new Date(),
    changeFrequency: "daily",
    priority: 0.9,
  },
  {
    url: buildCanonical("/nutrition/calculator"),
    lastModified: new Date(),
    changeFrequency: "monthly",
    priority: 0.8,
  },
  {
    url: buildCanonical("/priority-customers"),
    lastModified: new Date(),
    changeFrequency: "monthly",
    priority: 0.7,
  },
  {
    url: buildCanonical("/about"),
    lastModified: new Date(),
    changeFrequency: "monthly",
    priority: 0.6,
  },
  {
    url: buildCanonical("/orders/track"),
    lastModified: new Date(),
    changeFrequency: "monthly",
    priority: 0.4,
  },
];

function createPublicClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseKey) return null;

  return createClient<Database>(supabaseUrl, supabaseKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const supabase = createPublicClient();
  if (!supabase) return staticRoutes;

  const [{ data: products }, { data: articles }] = await Promise.all([
    supabase
      .from("products")
      .select("id, updated_at")
      .eq("is_active", true)
      .order("updated_at", { ascending: false })
      .limit(1000),
    supabase
      .from("nutrition_articles")
      .select("slug, updated_at, published_at")
      .eq("status", "published")
      .order("published_at", { ascending: false })
      .limit(1000),
  ]);

  const productRoutes = ((products || []) as SitemapProductRow[]).map(
    (product) => ({
      url: buildCanonical(`/products/${product.id}`),
      lastModified: new Date(product.updated_at),
      changeFrequency: "weekly" as const,
      priority: 0.7,
    }),
  );

  const articleRoutes = ((articles || []) as SitemapArticleRow[]).map(
    (article) => ({
      url: buildCanonical(`/nutrition/${article.slug}`),
      lastModified: new Date(article.updated_at || article.published_at || ""),
      changeFrequency: "weekly" as const,
      priority: 0.8,
    }),
  );

  return [...staticRoutes, ...articleRoutes, ...productRoutes];
}
