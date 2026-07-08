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
  author_name: string | null;
  status: string;
  published_at: string | null;
  created_at: string;
  updated_at: string;
  nutrition_categories?: {
    name: string;
    slug: string;
  } | null;
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
    .select(
      "title, slug, excerpt, content, cover_image_url, author_name, status, published_at, created_at, updated_at, nutrition_categories(name, slug)",
    )
    .eq("slug", slug)
    .eq("status", "published")
    .maybeSingle();

  if (error) return null;
  return data as unknown as ArticleSeoRow | null;
}

function getArticleDescription(article: ArticleSeoRow) {
  return truncateDescription(
    article.excerpt ||
      stripHtml(article.content || "") ||
      DEFAULT_SEO_DESCRIPTION,
  );
}

function getArticleSocialImage(article: ArticleSeoRow) {
  return article.cover_image_url
    ? {
        url: toAbsoluteUrl(article.cover_image_url),
        width: 1200,
        height: 630,
        alt: article.title,
      }
    : getDefaultSocialImage(article.title);
}

function buildArticleJsonLd(
  article: ArticleSeoRow,
  canonical: string,
  description: string,
  imageUrl: string,
) {
  return {
    "@context": "https://schema.org",
    "@type": "Article",
    "@id": `${canonical}#article`,
    headline: article.title,
    description,
    image: [imageUrl],
    mainEntityOfPage: canonical,
    datePublished: article.published_at || article.created_at,
    dateModified: article.updated_at,
    author: {
      "@type": "Person",
      name: article.author_name || APP_CONFIG.shopName,
    },
    publisher: {
      "@id": `${SITE_URL}/#organization`,
      name: APP_CONFIG.shopName,
    },
    inLanguage: "vi-VN",
    articleSection: article.nutrition_categories?.name || "Dinh dưỡng",
  };
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

  const description = getArticleDescription(article);
  const title = buildPageTitle(article.title);
  const socialImage = getArticleSocialImage(article);

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
  params,
}: NutritionArticleLayoutProps) {
  return (
    <NutritionArticleStructuredData params={params}>
      {children}
    </NutritionArticleStructuredData>
  );
}

async function NutritionArticleStructuredData({
  children,
  params,
}: NutritionArticleLayoutProps) {
  const { slug } = await params;
  const article = await getArticleSeo(slug);

  if (!article) {
    return children;
  }

  const canonical = buildCanonical(`/nutrition/${article.slug}`);
  const description = getArticleDescription(article);
  const socialImage = getArticleSocialImage(article);
  const structuredData = [
    buildBreadcrumbJsonLd([
      { name: "Trang chủ", path: "/" },
      { name: "Dinh dưỡng", path: "/nutrition" },
      { name: article.title, url: canonical },
    ]),
    buildArticleJsonLd(article, canonical, description, socialImage.url),
  ];

  return (
    <>
      <JsonLd data={structuredData} />
      {children}
    </>
  );
}
