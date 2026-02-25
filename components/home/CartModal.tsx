"use client";

import { Button, Drawer, Empty, Image, Space, Typography } from "antd";
import { PlusOutlined, MinusOutlined, DeleteOutlined } from "@ant-design/icons";
import { formatCurrency } from "@/lib/utils";
import type { CartItem } from "@/hooks/useCart";

interface CartModalProps {
  isOpen: boolean;
  onClose: () => void;
  cart: CartItem[];
  onUpdateQuantity: (productId: string, quantity: number) => void;
  onRemoveItem: (productId: string) => void;
  onCheckout: () => void;
  totalPrice: number;
}

export function CartModal({
  isOpen,
  onClose,
  cart,
  onUpdateQuantity,
  onRemoveItem,
  onCheckout,
  totalPrice,
}: CartModalProps) {
  return (
    <Drawer
      title="Giỏ hàng"
      placement="right"
      size={420}
      open={isOpen}
      onClose={onClose}
      destroyOnHidden
      footer={
        cart.length > 0 ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                fontWeight: 700,
                fontSize: 18,
              }}
            >
              <span>Tổng cộng:</span>
              <span style={{ color: "#1677ff" }}>
                {formatCurrency(totalPrice)}
              </span>
            </div>
            <Button type="primary" size="large" block onClick={onCheckout}>
              Thanh toán
            </Button>
          </div>
        ) : null
      }
    >
      {cart.length === 0 ? (
        <div
          style={{ display: "flex", justifyContent: "center", paddingTop: 80 }}
        >
          <Empty description="Giỏ hàng trống" />
        </div>
      ) : (
        <Space orientation="vertical" size={12} style={{ width: "100%" }}>
          {cart.map((item) => (
            <div
              key={item.product.id}
              style={{
                display: "flex",
                gap: 12,
                background: "#f5f5f5",
                padding: 12,
                borderRadius: 10,
              }}
            >
              <div
                style={{
                  width: 76,
                  height: 76,
                  borderRadius: 8,
                  overflow: "hidden",
                  background: "#fff",
                  flexShrink: 0,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                {item.product.image_url ? (
                  <Image
                    src={item.product.image_url}
                    alt={item.product.name}
                    width={76}
                    height={76}
                    loading="lazy"
                    style={{ objectFit: "cover" }}
                    preview={false}
                  />
                ) : (
                  <span style={{ fontSize: 24 }}>📦</span>
                )}
              </div>

              <div style={{ flex: 1, minWidth: 0 }}>
                <Typography.Text
                  strong
                  style={{ display: "block", marginBottom: 4 }}
                >
                  {item.product.name}
                </Typography.Text>
                <Typography.Text
                  strong
                  style={{
                    color: "#1677ff",
                    display: "block",
                    marginBottom: 8,
                  }}
                >
                  {formatCurrency(item.product.price)}
                </Typography.Text>

                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                  }}
                >
                  <Button
                    icon={<MinusOutlined />}
                    size="small"
                    onClick={() =>
                      onUpdateQuantity(item.product.id, item.quantity - 1)
                    }
                  />
                  <Typography.Text
                    style={{ minWidth: 20, textAlign: "center" }}
                  >
                    {item.quantity}
                  </Typography.Text>
                  <Button
                    icon={<PlusOutlined />}
                    size="small"
                    disabled={item.quantity >= item.product.stock_quantity}
                    onClick={() =>
                      onUpdateQuantity(item.product.id, item.quantity + 1)
                    }
                  />
                  <Button
                    danger
                    type="text"
                    icon={<DeleteOutlined />}
                    onClick={() => onRemoveItem(item.product.id)}
                    style={{ marginLeft: "auto" }}
                  />
                </div>
              </div>
            </div>
          ))}
        </Space>
      )}
    </Drawer>
  );
}
