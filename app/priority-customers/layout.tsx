import type { Metadata } from "next";
import { APP_CONFIG } from "@/lib/appConfig";
import {
  buildCanonical,
  buildPageTitle,
  getDefaultSocialImage,
} from "@/lib/seo";

const description = `Danh sách khách hàng ưu tiên của ${APP_CONFIG.shopName}.`;

export const metadata: Metadata = {
  title: { absolute: buildPageTitle("Danh sách khách hàng ưu tiên") },
  description,
  alternates: { canonical: buildCanonical("/priority-customers") },
  openGraph: {
    type: "website",
    locale: "vi_VN",
    url: buildCanonical("/priority-customers"),
    siteName: APP_CONFIG.shopName,
    title: buildPageTitle("Danh sách khách hàng ưu tiên"),
    description,
    images: [getDefaultSocialImage("Khách hàng ưu tiên")],
  },
  twitter: {
    card: "summary_large_image",
    title: buildPageTitle("Danh sách khách hàng ưu tiên"),
    description,
    images: [getDefaultSocialImage().url],
  },
};

export default function PriorityCustomersLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return children;
}
