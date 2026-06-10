import type { Metadata } from "next";
import { APP_CONFIG } from "@/lib/appConfig";
import { buildCanonical, buildPageTitle } from "@/lib/seo";

export const metadata: Metadata = {
  title: { absolute: buildPageTitle("Thanh toán đơn hàng") },
  description: `Hoàn tất đơn hàng tại ${APP_CONFIG.shopName}.`,
  alternates: { canonical: buildCanonical("/checkout") },
  robots: {
    index: false,
    follow: false,
  },
};

export default function CheckoutLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return children;
}
