import type { Metadata, Viewport } from "next";
import { Suspense } from "react";
import { Geist, Geist_Mono } from "next/font/google";
import { AntdRegistry } from "@ant-design/nextjs-registry";
import { GoogleAnalytics } from "@/components/analytics/GoogleAnalytics";
import { FaviconSync } from "@/components/home/FaviconSync";
import { APP_CONFIG } from "@/lib/appConfig";
import { TitleSync } from "@/components/seo/TitleSync";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const siteUrl = "https://smartlifehub.vn";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: `${APP_CONFIG.shopName} – Đồ gia dụng thông minh`,
    template: `%s | ${APP_CONFIG.shopName}`,
  },
  description:
    "SmartLife Hub - Cửa hàng đồ gia dụng thông minh, chính hãng, hỗ trợ theo dõi đơn hàng và ưu đãi dành cho khách hàng thân thiết.",
  openGraph: {
    type: "website",
    locale: "vi_VN",
    url: siteUrl,
    siteName: APP_CONFIG.shopName,
    title: `${APP_CONFIG.shopName} – Đồ gia dụng thông minh`,
    description:
      "Khám phá đồ gia dụng thông minh, tối ưu không gian sống với SmartLife Hub.",
    images: [
      {
        url: "/banners/banner-1.svg",
        width: 1600,
        height: 520,
        alt: "SmartLife Hub - Ưu đãi gia dụng thông minh",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: `${APP_CONFIG.shopName} – Đồ gia dụng thông minh`,
    description:
      "Cửa hàng đồ gia dụng thông minh, chính hãng, nhiều ưu đãi cho khách hàng thân thiết.",
    images: ["/banners/banner-1.svg"],
  },
  robots: {
    index: true,
    follow: true,
  },
  alternates: {
    canonical: "/",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#ffffff",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="vi">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <AntdRegistry>{children}</AntdRegistry>
        <FaviconSync />
        <Suspense fallback={null}>
          <GoogleAnalytics />
        </Suspense>
        <TitleSync />
      </body>
    </html>
  );
}
