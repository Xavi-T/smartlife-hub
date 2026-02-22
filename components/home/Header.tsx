"use client";

import Link from "next/link";
import { Badge, Button, Space, Typography } from "antd";
import { ShoppingCartOutlined } from "@ant-design/icons";

interface HeaderProps {
  cartItemsCount: number;
  onCartClick: () => void;
}

export function Header({ cartItemsCount, onCartClick }: HeaderProps) {
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
            minHeight: 64,
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
                width: 40,
                height: 40,
                border: "2px solid #1677ff",
                borderRadius: 8,
                display: "grid",
                placeItems: "center",
              }}
            >
              <img
                src="/logo.png"
                alt="SmartLife Hub Logo"
                className="w-6 h-6"
              />
            </div>
            <div>
              <Typography.Title level={4} style={{ margin: 0 }}>
                SmartLife Hub
              </Typography.Title>
              <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                Đồ gia dụng thông minh
              </Typography.Text>
            </div>
          </Link>

          <Space size="small">
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
      </div>
    </header>
  );
}
