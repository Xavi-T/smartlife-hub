"use client";

import Link from "next/link";
import Image from "next/image";
import { Space, Typography } from "antd";
import { APP_CONFIG } from "@/lib/appConfig";

const socialItems = [
  {
    key: "zalo",
    label: "Zalo",
    href: APP_CONFIG.socials.zalo,
    iconSrc: "/icons/zalo.png",
  },
  {
    key: "facebook",
    label: "Facebook",
    href: APP_CONFIG.socials.facebook,
    iconSrc: "/icons/facebook.png",
  },
  {
    key: "youtube",
    label: "YouTube",
    href: APP_CONFIG.socials.youtube,
    iconSrc: "/icons/youtube.png",
  },
  {
    key: "tiktok",
    label: "TikTok",
    href: APP_CONFIG.socials.tiktok,
    iconSrc: "/icons/tiktok.png",
  },
];

export function SiteFooter() {
  return (
    <footer
      style={{
        borderTop: "1px solid #e5e7eb",
        background: "#fff",
      }}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div>
            <Typography.Title level={5} style={{ marginTop: 0 }}>
              {APP_CONFIG.shopName}
            </Typography.Title>
            <Typography.Paragraph type="secondary" style={{ marginBottom: 6 }}>
              {APP_CONFIG.shopTagline}
            </Typography.Paragraph>
            <Typography.Text type="secondary">
              {APP_CONFIG.shopAddress}
            </Typography.Text>
          </div>

          <div>
            <Typography.Title level={5} style={{ marginTop: 0 }}>
              Liên hệ
            </Typography.Title>
            <Space orientation="vertical" size={4}>
              <Typography.Text>Hotline: {APP_CONFIG.shopPhone}</Typography.Text>
              <Typography.Text>Email: {APP_CONFIG.shopEmail}</Typography.Text>
              <Typography.Text>MST: {APP_CONFIG.taxCode}</Typography.Text>
            </Space>
          </div>

          <div>
            <Typography.Title level={5} style={{ marginTop: 0 }}>
              Kết nối với chúng tôi
            </Typography.Title>
            <Space orientation="vertical" size={8}>
              {socialItems.map((item) => {
                return (
                  <a
                    key={item.key}
                    href={item.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 8,
                      color: "#111111",
                      textDecoration: "none",
                    }}
                  >
                    <Image
                      src={item.iconSrc}
                      alt={item.label}
                      width={20}
                      height={20}
                      style={{
                        width: 20,
                        height: 20,
                        objectFit: "contain",
                        display: "block",
                        borderRadius: 4,
                      }}
                    />
                    <span style={{ color: "#111111" }}>{item.label}</span>
                  </a>
                );
              })}
            </Space>
          </div>
        </div>

        <div style={{ marginTop: 20 }}>
          <Space wrap size={12}>
            <Link href="/" style={{ color: "#111111" }}>
              Trang chủ
            </Link>
            <Link href="/about" style={{ color: "#111111" }}>
              Về chúng tôi
            </Link>
            <Link href="/orders/track" style={{ color: "#111111" }}>
              Tra cứu đơn
            </Link>
          </Space>
          <Typography.Text
            type="secondary"
            style={{ display: "block", marginTop: 12, fontSize: 12 }}
          >
            {`© ${new Date().getFullYear()} ${APP_CONFIG.shopName}. All rights reserved.`}
          </Typography.Text>
        </div>
      </div>
    </footer>
  );
}
