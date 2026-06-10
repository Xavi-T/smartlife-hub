import type { Metadata } from "next";
import { APP_CONFIG } from "@/lib/appConfig";
import {
  buildCanonical,
  buildPageTitle,
  getDefaultSocialImage,
} from "@/lib/seo";

export const metadata: Metadata = {
  title: { absolute: buildPageTitle("Về SmartLife Hub") },
  description: `${APP_CONFIG.shopName} theo đuổi định hướng ${APP_CONFIG.shopTagline}, kết hợp tư vấn dinh dưỡng, kiến thức ăn uống lành mạnh và sản phẩm phù hợp cho gia đình.`,
  alternates: { canonical: buildCanonical("/about") },
  openGraph: {
    type: "website",
    locale: "vi_VN",
    url: buildCanonical("/about"),
    siteName: APP_CONFIG.shopName,
    title: buildPageTitle("Về SmartLife Hub"),
    description: `${APP_CONFIG.shopName} - ${APP_CONFIG.shopTagline}.`,
    images: [getDefaultSocialImage("Về SmartLife Hub")],
  },
  twitter: {
    card: "summary_large_image",
    title: buildPageTitle("Về SmartLife Hub"),
    description: `${APP_CONFIG.shopName} - ${APP_CONFIG.shopTagline}.`,
    images: [getDefaultSocialImage().url],
  },
};

export default function AboutLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return children;
}
