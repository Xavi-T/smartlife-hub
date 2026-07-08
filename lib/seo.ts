import { APP_CONFIG } from "@/lib/appConfig";

export const SITE_URL = APP_CONFIG.shopWebsite.replace(/\/$/, "");
export const DEFAULT_OG_IMAGE = "/opengraph-image";

export const DEFAULT_SEO_DESCRIPTION =
  `${APP_CONFIG.shopName} - ${APP_CONFIG.shopTagline}. ` +
  "Tư vấn dinh dưỡng, chia sẻ kiến thức ăn uống lành mạnh, tính nhu cầu calo và gợi ý sản phẩm phù hợp cho gia đình Việt.";

export const SEO_KEYWORDS = [
  "SmartLife Hub",
  "dinh dưỡng",
  "tư vấn dinh dưỡng",
  "tính calo",
  "thực phẩm lành mạnh",
  "sữa mẹ bầu",
  "sữa trẻ em",
  "sản phẩm chăm sóc sức khỏe",
  "Hải Phòng",
];

export function buildPageTitle(title?: string) {
  if (!title) return `${APP_CONFIG.shopName} – ${APP_CONFIG.shopTagline}`;
  return `${title} | ${APP_CONFIG.shopName}`;
}

export function buildCanonical(path = "/") {
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  return `${SITE_URL}${normalizedPath}`;
}

export function toAbsoluteUrl(pathOrUrl: string): string {
  if (/^https?:\/\//i.test(pathOrUrl)) {
    return pathOrUrl;
  }

  const normalizedPath = pathOrUrl.startsWith("/")
    ? pathOrUrl
    : `/${pathOrUrl}`;
  return `${SITE_URL}${normalizedPath}`;
}

export function stripHtml(input: string) {
  return input
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function truncateDescription(input: string, maxLength = 180): string {
  const normalized = input.replace(/\s+/g, " ").trim();
  if (normalized.length <= maxLength) return normalized;
  return `${normalized.slice(0, maxLength - 3).trim()}...`;
}

export function getDefaultSocialImage(alt = APP_CONFIG.shopTagline) {
  return {
    url: toAbsoluteUrl(DEFAULT_OG_IMAGE),
    width: 1200,
    height: 630,
    alt: `${APP_CONFIG.shopName} - ${alt}`,
  };
}

export function buildBreadcrumbJsonLd(
  items: Array<{ name: string; path?: string; url?: string }>,
) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: item.name,
      item: item.url || buildCanonical(item.path || "/"),
    })),
  };
}

export function buildSiteJsonLd() {
  const sameAs = Object.values(APP_CONFIG.socials).filter(Boolean);

  return [
    {
      "@context": "https://schema.org",
      "@type": "HealthAndBeautyBusiness",
      "@id": `${SITE_URL}/#organization`,
      name: APP_CONFIG.shopName,
      url: SITE_URL,
      logo: toAbsoluteUrl(APP_CONFIG.defaultLogo),
      image: toAbsoluteUrl(APP_CONFIG.defaultLogo),
      description: DEFAULT_SEO_DESCRIPTION,
      telephone: APP_CONFIG.shopPhone,
      email: APP_CONFIG.shopEmail,
      taxID: APP_CONFIG.taxCode,
      address: {
        "@type": "PostalAddress",
        streetAddress: APP_CONFIG.shopAddress,
        addressLocality: "Hải Phòng",
        addressCountry: "VN",
      },
      sameAs,
    },
    {
      "@context": "https://schema.org",
      "@type": "WebSite",
      "@id": `${SITE_URL}/#website`,
      name: APP_CONFIG.shopName,
      url: SITE_URL,
      publisher: {
        "@id": `${SITE_URL}/#organization`,
      },
      inLanguage: "vi-VN",
    },
  ];
}
