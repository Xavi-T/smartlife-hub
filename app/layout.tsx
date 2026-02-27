import type { Metadata, Viewport } from "next";
import { Suspense } from "react";
import { Geist, Geist_Mono } from "next/font/google";
import { AntdRegistry } from "@ant-design/nextjs-registry";
import { GoogleAnalytics } from "@/components/analytics/GoogleAnalytics";
import { FaviconSync } from "@/components/home/FaviconSync";
import { PublicSiteWidgets } from "@/components/home/PublicSiteWidgets";
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

const siteUrl = APP_CONFIG.shopWebsite;

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: `${APP_CONFIG.shopName} – ${APP_CONFIG.shopTagline}`,
    template: `%s | ${APP_CONFIG.shopName}`,
  },
  description: `${APP_CONFIG.shopName} – ${APP_CONFIG.shopTagline}.`,
  openGraph: {
    type: "website",
    locale: "vi_VN",
    url: siteUrl,
    siteName: APP_CONFIG.shopName,
    title: `${APP_CONFIG.shopName} – ${APP_CONFIG.shopTagline}`,
    description: `${APP_CONFIG.shopName} – ${APP_CONFIG.shopTagline}.`,
    images: [
      {
        url: "/opengraph-image",
        width: 1200,
        height: 630,
        alt: `${APP_CONFIG.shopName} - ${APP_CONFIG.shopTagline}`,
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: `${APP_CONFIG.shopName} – ${APP_CONFIG.shopTagline}`,
    description: `${APP_CONFIG.shopName} – ${APP_CONFIG.shopTagline}.`,
    images: ["/opengraph-image"],
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
        <AntdRegistry>
          {children}
          <PublicSiteWidgets />
        </AntdRegistry>
        <FaviconSync />
        <Suspense fallback={null}>
          <GoogleAnalytics />
        </Suspense>
        <TitleSync />
      </body>
    </html>
  );
}
