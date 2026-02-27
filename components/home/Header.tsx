"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { Badge, Button, Drawer, Space, Typography } from "antd";
import { MenuOutlined, ShoppingCartOutlined } from "@ant-design/icons";
import { APP_CONFIG } from "@/lib/appConfig";
import { getOptimizedImageUrl } from "@/lib/imageUtils";

interface HeaderProps {
  cartItemsCount: number;
  onCartClick: () => void;
}

export function Header({ cartItemsCount, onCartClick }: HeaderProps) {
  const [logoSrc, setLogoSrc] = useState("/logo.png");
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

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
            <Space size="small">
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
              <Button
                type="text"
                shape="circle"
                icon={<MenuOutlined style={{ fontSize: 20 }} />}
                onClick={() => setMobileMenuOpen(true)}
                aria-label="Mở menu"
              />
            </Space>
          </div>
        </div>
      </div>

      <Drawer
        title="Menu"
        placement="right"
        open={mobileMenuOpen}
        onClose={() => setMobileMenuOpen(false)}
      >
        <Space orientation="vertical" size={8} style={{ width: "100%" }}>
          <Link href="/about" onClick={() => setMobileMenuOpen(false)}>
            <Button block>Về chúng tôi</Button>
          </Link>
          <Link
            href="/priority-customers"
            onClick={() => setMobileMenuOpen(false)}
          >
            <Button block>Danh sách KH ưu tiên</Button>
          </Link>
          <Link href="/orders/track" onClick={() => setMobileMenuOpen(false)}>
            <Button block>Tra cứu đơn</Button>
          </Link>
        </Space>
      </Drawer>
    </header>
  );
}
