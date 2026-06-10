import type { Metadata } from "next";
import { APP_CONFIG } from "@/lib/appConfig";
import {
  buildCanonical,
  buildPageTitle,
  getDefaultSocialImage,
} from "@/lib/seo";

const description = `Tra cứu trạng thái đơn hàng đã đặt tại ${APP_CONFIG.shopName} bằng số điện thoại.`;

export const metadata: Metadata = {
  title: { absolute: buildPageTitle("Tra cứu đơn hàng") },
  description,
  alternates: { canonical: buildCanonical("/orders/track") },
  openGraph: {
    type: "website",
    locale: "vi_VN",
    url: buildCanonical("/orders/track"),
    siteName: APP_CONFIG.shopName,
    title: buildPageTitle("Tra cứu đơn hàng"),
    description,
    images: [getDefaultSocialImage("Tra cứu đơn hàng")],
  },
  twitter: {
    card: "summary_large_image",
    title: buildPageTitle("Tra cứu đơn hàng"),
    description,
    images: [getDefaultSocialImage().url],
  },
};

export default function OrderTrackingLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return children;
}
