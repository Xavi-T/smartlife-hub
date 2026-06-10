import type { Metadata } from "next";
import { createClient } from "@supabase/supabase-js";
import { APP_CONFIG } from "@/lib/appConfig";
import type { Database } from "@/types/database";
import {
  DEFAULT_SEO_DESCRIPTION,
  buildCanonical,
  buildPageTitle,
  getDefaultSocialImage,
  stripHtml,
  toAbsoluteUrl,
  truncateDescription,
} from "@/lib/seo";

interface NutritionArticleLayoutProps {
  children: React.ReactNode;
  params: Promise<{ slug: string }>;
}

interface ArticleSeoRow {
  title: string;
  slug: string;
  excerpt: string | null;
  content: string | null;
  cover_image_url: string | null;
  status: string;
}

async function getArticleSeo(slug: string) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseKey) return null;

  const supabase = createClient<Database>(supabaseUrl, supabaseKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data, error } = await supabase
    .from("nutrition_articles")
    .select("title, slug, excerpt, content, cover_image_url, status")
    .eq("slug", slug)
    .eq("status", "published")
    .maybeSingle();

  if (error) return null;
  return data as ArticleSeoRow | null;
}

export async function generateMetadata({
  params,
}: NutritionArticleLayoutProps): Promise<Metadata> {
  const { slug } = await params;
  const canonical = buildCanonical(`/nutrition/${slug}`);
  const article = await getArticleSeo(slug);

  if (!article) {
    return {
      title: { absolute: buildPageTitle("Bài viết dinh dưỡng") },
      description: DEFAULT_SEO_DESCRIPTION,
      alternates: { canonical },
      robots: {
        index: false,
        follow: true,
      },
      openGraph: {
        type: "article",
        locale: "vi_VN",
        url: canonical,
        siteName: APP_CONFIG.shopName,
        title: buildPageTitle("Bài viết dinh dưỡng"),
        description: DEFAULT_SEO_DESCRIPTION,
        images: [getDefaultSocialImage("Bài viết dinh dưỡng")],
      },
      twitter: {
        card: "summary_large_image",
        title: buildPageTitle("Bài viết dinh dưỡng"),
        description: DEFAULT_SEO_DESCRIPTION,
        images: [getDefaultSocialImage().url],
      },
    };
  }

  const description = truncateDescription(
    article.excerpt ||
      stripHtml(article.content || "") ||
      DEFAULT_SEO_DESCRIPTION,
  );
  const title = buildPageTitle(article.title);
  const socialImage = article.cover_image_url
    ? {
        url: toAbsoluteUrl(article.cover_image_url),
        width: 1200,
        height: 630,
        alt: article.title,
      }
    : getDefaultSocialImage(article.title);

  return {
    title: { absolute: title },
    description,
    alternates: { canonical },
    openGraph: {
      type: "article",
      locale: "vi_VN",
      url: canonical,
      siteName: APP_CONFIG.shopName,
      title,
      description,
      images: [socialImage],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [socialImage.url],
    },
  };
}

export default function NutritionArticleLayout({
  children,
}: NutritionArticleLayoutProps) {
  return children;
}
