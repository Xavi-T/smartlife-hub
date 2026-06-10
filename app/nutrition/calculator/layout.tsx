import type { Metadata } from "next";
import { APP_CONFIG } from "@/lib/appConfig";
import {
  buildCanonical,
  buildPageTitle,
  getDefaultSocialImage,
} from "@/lib/seo";

const description =
  "Công cụ tính BMI, BMR, TDEE, calo mục tiêu và macro gợi ý để khách hàng tự ước tính nhu cầu dinh dưỡng cơ bản.";

export const metadata: Metadata = {
  title: { absolute: buildPageTitle("Tính nhu cầu dinh dưỡng") },
  description,
  alternates: { canonical: buildCanonical("/nutrition/calculator") },
  openGraph: {
    type: "website",
    locale: "vi_VN",
    url: buildCanonical("/nutrition/calculator"),
    siteName: APP_CONFIG.shopName,
    title: buildPageTitle("Tính nhu cầu dinh dưỡng"),
    description,
    images: [getDefaultSocialImage("Tính nhu cầu dinh dưỡng")],
  },
  twitter: {
    card: "summary_large_image",
    title: buildPageTitle("Tính nhu cầu dinh dưỡng"),
    description,
    images: [getDefaultSocialImage().url],
  },
};

export default function NutritionCalculatorLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return children;
}
