"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { Badge, Button, Space, Typography } from "antd";
import {
  HomeOutlined,
  InfoCircleOutlined,
  SearchOutlined,
  ShoppingCartOutlined,
  StarOutlined,
} from "@ant-design/icons";
import { APP_CONFIG } from "@/lib/appConfig";
import { getOptimizedImageUrl } from "@/lib/imageUtils";
import { usePathname } from "next/navigation";

interface HeaderProps {
  cartItemsCount: number;
  onCartClick: () => void;
}

export function Header({ cartItemsCount, onCartClick }: HeaderProps) {
  const pathname = usePathname();
  const [logoSrc, setLogoSrc] = useState(APP_CONFIG.defaultLogo);
  const mobileNavItems = useMemo(
    () => [
      { href: "/", label: "Trang chủ", icon: <HomeOutlined /> },
      { href: "/about", label: "Về chúng tôi", icon: <InfoCircleOutlined /> },
      {
        href: "/priority-customers",
        label: "KH ưu tiên",
        icon: <StarOutlined />,
      },
      { href: "/orders/track", label: "Tra cứu đơn", icon: <SearchOutlined /> },
    ],
    [],
  );

  useEffect(() => {
    let active = true;

    const loadSiteLogo = async () => {
      try {
        const response = await fetch("/api/media?purpose=site_logo", {
          cache: "no-store",
        });

        if (!response.ok) return;

        const result = await response.json();
        const firstLogo = Array.isArray(result.media) ? result.media[0] : null;

        if (active && firstLogo?.image_url) {
          setLogoSrc(
            getOptimizedImageUrl(firstLogo.image_url, {
              width: 180,
              quality: 92,
              format: "webp",
            }),
          );
        }
      } catch {
        // Keep default logo fallback
      }
    };

    loadSiteLogo();

    return () => {
      active = false;
    };
  }, []);

  return (
    <header
      style={{
        position: "sticky",
        top: 0,
        zIndex: 50,
        background: "#fff",
        borderBottom: "1px solid #f0f0f0",
        boxShadow: "0 1px 4px rgba(0,0,0,0.06)",
      }}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            minHeight: 76,
            flexWrap: "wrap",
            rowGap: 8,
          }}
        >
          <Link
            href="/"
            style={{
              display: "flex",
              alignItems: "center",
              gap: 12,
            }}
          >
            <div
              style={{
                width: 56,
                height: 56,
                border: "2px solid #1677ff",
                borderRadius: 12,
                display: "grid",
                placeItems: "center",
                overflow: "hidden",
                background: "#fff",
              }}
            >
              <Image
                src={logoSrc}
                alt={`${APP_CONFIG.shopName} Logo`}
                width={48}
                height={48}
                className="w-12 h-12 object-contain"
                priority
              />
            </div>
            <div>
              <Typography.Title level={4} style={{ margin: 0 }}>
                {APP_CONFIG.shopName}
              </Typography.Title>
              <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                {APP_CONFIG.shopTagline}
              </Typography.Text>
            </div>
          </Link>

          <div className="hidden md:block">
            <Space size="small" wrap>
              <Link href="/about">
                <Button type="text">Về chúng tôi</Button>
              </Link>
              <Link href="/priority-customers">
                <Button type="text">Danh sách KH ưu tiên</Button>
              </Link>
              <Link href="/orders/track">
                <Button type="text">Tra cứu đơn</Button>
              </Link>
              <Badge
                count={cartItemsCount > 9 ? "9+" : cartItemsCount}
                size="small"
              >
                <Button
                  type="text"
                  shape="circle"
                  icon={<ShoppingCartOutlined style={{ fontSize: 20 }} />}
                  onClick={onCartClick}
                  aria-label="Giỏ hàng"
                />
              </Badge>
            </Space>
          </div>

          <div className="block md:hidden">
            <Badge
              count={cartItemsCount > 9 ? "9+" : cartItemsCount}
              size="small"
            >
              <Button
                type="text"
                shape="circle"
                icon={<ShoppingCartOutlined style={{ fontSize: 20 }} />}
                onClick={onCartClick}
                aria-label="Giỏ hàng"
              />
            </Badge>
          </div>
        </div>
      </div>

      <nav
        className="md:hidden fixed bottom-0 left-0 right-0"
        style={{
          zIndex: 60,
          background: "#fff",
          borderTop: "1px solid #f0f0f0",
          boxShadow: "0 -1px 4px rgba(0,0,0,0.06)",
        }}
        aria-label="Điều hướng mobile"
      >
        <div className="grid grid-cols-5 px-1 py-1">
          {mobileNavItems.map((item) => {
            const isActive = pathname === item.href;

            return (
              <Link
                key={item.href}
                href={item.href}
                className="flex flex-col items-center justify-center py-1"
                style={{
                  color: isActive ? "#1677ff" : "rgba(0,0,0,0.65)",
                  textDecoration: "none",
                }}
              >
                <span style={{ fontSize: 18, lineHeight: 1 }}>{item.icon}</span>
                <span style={{ fontSize: 11, marginTop: 4 }}>{item.label}</span>
              </Link>
            );
          })}

          <button
            type="button"
            className="flex flex-col items-center justify-center py-1"
            style={{
              border: "none",
              background: "transparent",
              color: "rgba(0,0,0,0.65)",
            }}
            onClick={onCartClick}
            aria-label="Mở giỏ hàng"
          >
            <Badge
              count={cartItemsCount > 9 ? "9+" : cartItemsCount}
              size="small"
              offset={[6, -2]}
            >
              <span style={{ fontSize: 18, lineHeight: 1 }}>
                <ShoppingCartOutlined />
              </span>
            </Badge>
            <span style={{ fontSize: 11, marginTop: 4 }}>Giỏ hàng</span>
          </button>
        </div>
      </nav>
    </header>
  );
}
