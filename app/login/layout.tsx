import type { Metadata } from "next";
import { buildCanonical, buildPageTitle } from "@/lib/seo";

export const metadata: Metadata = {
  title: { absolute: buildPageTitle("Đăng nhập quản trị") },
  alternates: { canonical: buildCanonical("/login") },
  robots: {
    index: false,
    follow: false,
  },
};

export default function LoginLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return children;
}
