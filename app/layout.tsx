import type { Metadata, Viewport } from "next";
import { Suspense } from "react";
import { AntdRegistry } from "@ant-design/nextjs-registry";
import { GoogleAnalytics } from "@/components/analytics/GoogleAnalytics";
import { FaviconSync } from "@/components/home/FaviconSync";
import { PublicSiteWidgets } from "@/components/home/PublicSiteWidgets";
import { APP_CONFIG } from "@/lib/appConfig";
import {
  DEFAULT_OG_IMAGE,
  DEFAULT_SEO_DESCRIPTION,
  SEO_KEYWORDS,
  SITE_URL,
} from "@/lib/seo";
import { TitleSync } from "@/components/seo/TitleSync";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  applicationName: APP_CONFIG.shopName,
  title: {
    default: `${APP_CONFIG.shopName} – ${APP_CONFIG.shopTagline}`,
    template: `%s | ${APP_CONFIG.shopName}`,
  },
  description: DEFAULT_SEO_DESCRIPTION,
  keywords: SEO_KEYWORDS,
  authors: [{ name: APP_CONFIG.shopName, url: SITE_URL }],
  creator: APP_CONFIG.shopName,
  publisher: APP_CONFIG.shopName,
  category: "nutrition",
  openGraph: {
    type: "website",
    locale: "vi_VN",
    url: SITE_URL,
    siteName: APP_CONFIG.shopName,
    title: `${APP_CONFIG.shopName} – ${APP_CONFIG.shopTagline}`,
    description: DEFAULT_SEO_DESCRIPTION,
    images: [
      {
        url: DEFAULT_OG_IMAGE,
        width: 1200,
        height: 630,
        alt: `${APP_CONFIG.shopName} - ${APP_CONFIG.shopTagline}`,
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: `${APP_CONFIG.shopName} – ${APP_CONFIG.shopTagline}`,
    description: DEFAULT_SEO_DESCRIPTION,
    images: [DEFAULT_OG_IMAGE],
  },
  robots: {
    index: true,
    follow: true,
  },
  alternates: {
    canonical: "/",
  },
  icons: {
    icon: APP_CONFIG.defaultLogo,
    apple: APP_CONFIG.defaultLogo,
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
      <body className="antialiased">
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
