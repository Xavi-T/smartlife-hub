import type { Metadata } from "next";
import { APP_CONFIG } from "@/lib/appConfig";
import {
  buildCanonical,
  buildPageTitle,
  getDefaultSocialImage,
} from "@/lib/seo";

const description =
  "Bài viết dinh dưỡng từ SmartLife Hub: kiến thức ăn uống lành mạnh, chăm sóc mẹ và bé, kiểm soát khẩu phần và lựa chọn sản phẩm phù hợp.";

export const metadata: Metadata = {
  title: { absolute: buildPageTitle("Kiến thức dinh dưỡng") },
  description,
  alternates: { canonical: buildCanonical("/nutrition") },
  openGraph: {
    type: "website",
    locale: "vi_VN",
    url: buildCanonical("/nutrition"),
    siteName: APP_CONFIG.shopName,
    title: buildPageTitle("Kiến thức dinh dưỡng"),
    description,
    images: [getDefaultSocialImage("Kiến thức dinh dưỡng")],
  },
  twitter: {
    card: "summary_large_image",
    title: buildPageTitle("Kiến thức dinh dưỡng"),
    description,
    images: [getDefaultSocialImage().url],
  },
};

export default function NutritionLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return children;
}
