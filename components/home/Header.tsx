"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { Badge, Button, Space, Typography } from "antd";
import {
  CalculatorOutlined,
  HomeOutlined,
  ReadOutlined,
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

let cachedLogoSrc: string | null = null;
let logoRequestPromise: Promise<string | null> | null = null;

async function fetchLogoSrc(): Promise<string | null> {
  if (cachedLogoSrc) return cachedLogoSrc;

  if (!logoRequestPromise) {
    logoRequestPromise = fetch("/api/media?purpose=site_logo")
      .then(async (response) => {
        if (!response.ok) return null;

        const result = await response.json();
        const firstLogo = Array.isArray(result.media) ? result.media[0] : null;

        if (!firstLogo?.image_url) {
          return null;
        }

        const optimized = getOptimizedImageUrl(firstLogo.image_url, {
          width: 180,
          quality: 92,
          format: "webp",
        });

        cachedLogoSrc = optimized;
        return optimized;
      })
      .catch(() => null)
      .finally(() => {
        logoRequestPromise = null;
      });
  }

  return logoRequestPromise;
}

export function Header({ cartItemsCount, onCartClick }: HeaderProps) {
  const pathname = usePathname();
  const [logoSrc, setLogoSrc] = useState(APP_CONFIG.defaultLogo);
  const mobileNavItems = useMemo(
    () => [
      { href: "/", label: "Trang chủ", icon: <HomeOutlined /> },
      { href: "/nutrition", label: "Dinh dưỡng", icon: <ReadOutlined /> },
      {
        href: "/nutrition/calculator",
        label: "Tính calo",
        icon: <CalculatorOutlined />,
      },
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
      const nextLogoSrc = await fetchLogoSrc();
      if (active && nextLogoSrc) {
        setLogoSrc(nextLogoSrc);
      }
    };

    loadSiteLogo();

    return () => {
      active = false;
    };
  }, []);

  return (
    <>
      <header
        className="sl-public-header md:sticky md:top-0"
        style={{
          zIndex: 50,
        }}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div
            className="min-h-14 sm:min-h-[76px]"
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
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
                className="sl-logo-frame w-10 h-10 sm:w-14 sm:h-14"
                style={{
                  border: "2px solid rgba(22, 139, 208, 0.9)",
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
                  className="w-8 h-8 sm:w-12 sm:h-12 object-contain"
                  priority
                />
              </div>
              <div className="hidden min-w-0 sm:block">
                <Typography.Title
                  level={4}
                  className="!mb-0 !text-lg sm:!text-xl"
                >
                  {APP_CONFIG.shopName}
                </Typography.Title>
                <Typography.Text
                  type="secondary"
                  className="hidden sm:block"
                  style={{ fontSize: 12 }}
                >
                  {APP_CONFIG.shopTagline}
                </Typography.Text>
              </div>
            </Link>

            <div className="hidden md:block">
              <Space size="small" wrap>
                <Link href="/about">
                  <Button className="sl-nav-link" type="text">
                    Về chúng tôi
                  </Button>
                </Link>
                <Link href="/nutrition">
                  <Button className="sl-nav-link" type="text">
                    Dinh dưỡng
                  </Button>
                </Link>
                <Link href="/nutrition/calculator">
                  <Button className="sl-nav-link" type="text">
                    Tính dinh dưỡng
                  </Button>
                </Link>
                <Link href="/priority-customers">
                  <Button className="sl-nav-link" type="text">
                    Danh sách KH ưu tiên
                  </Button>
                </Link>
                <Link href="/orders/track">
                  <Button className="sl-nav-link" type="text">
                    Tra cứu đơn
                  </Button>
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
      </header>

      <nav
        className="sl-bottom-nav md:hidden fixed bottom-0 left-0 right-0"
        style={{
          zIndex: 60,
        }}
        aria-label="Điều hướng mobile"
      >
        <div className="grid grid-cols-6 px-1 py-0.5 pb-[calc(0.125rem+env(safe-area-inset-bottom))]">
          {mobileNavItems.map((item) => {
            const isActive = pathname === item.href;

            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={isActive ? "page" : undefined}
                className="sl-bottom-nav-item flex min-w-0 flex-col items-center justify-center px-0.5 py-0.5"
                style={{
                  color: isActive ? "#1677ff" : "rgba(0,0,0,0.65)",
                  textDecoration: "none",
                }}
              >
                <span style={{ fontSize: 17, lineHeight: 1 }}>{item.icon}</span>
                <span
                  className="max-w-full truncate"
                  style={{ fontSize: 10, marginTop: 2 }}
                >
                  {item.label}
                </span>
              </Link>
            );
          })}

          <button
            type="button"
            className="sl-bottom-nav-item flex min-w-0 flex-col items-center justify-center px-0.5 py-0.5"
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
              <span style={{ fontSize: 17, lineHeight: 1 }}>
                <ShoppingCartOutlined />
              </span>
            </Badge>
            <span
              className="max-w-full truncate"
              style={{ fontSize: 10, marginTop: 2 }}
            >
              Giỏ hàng
            </span>
          </button>
        </div>
      </nav>
    </>
  );
}
