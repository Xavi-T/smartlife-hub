"use client";

import { Button, Card, Image, Space, Tag, Typography } from "antd";
import { ShoppingCartOutlined } from "@ant-design/icons";
import {
  calculateDiscountedPrice,
  formatCurrency,
  getEffectiveDiscountPercent,
} from "@/lib/utils";
import type { Product } from "@/types/database";

interface ProductCardProps {
  product: Product;
  onAddToCart: (product: Product) => void;
  onViewDetail: (product: Product) => void;
}

export function ProductCard({
  product,
  onAddToCart,
  onViewDetail,
}: ProductCardProps) {
  const isOutOfStock = product.stock_quantity === 0;
  const discountPercent = getEffectiveDiscountPercent({
    discountPercent: product.discount_percent,
    discountStartAt: product.discount_start_at,
    discountEndAt: product.discount_end_at,
  });
  const hasDiscount = discountPercent > 0;
  const finalPrice = calculateDiscountedPrice(product.price, discountPercent);
  const savingAmount = product.price - finalPrice;
  const imageUrl = product.image_url || undefined;

  return (
    <Card
      hoverable={!isOutOfStock}
      styles={{
        body: {
          padding: 12,
          height: "100%",
          display: "flex",
          flexDirection: "column",
        },
      }}
      style={{
        overflow: "hidden",
        height: "100%",
        width: "100%",
        borderRadius: 12,
      }}
      onClick={() => onViewDetail(product)}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onViewDetail(product);
        }
      }}
      role="button"
      tabIndex={0}
    >
      <div
        style={{
          position: "relative",
          aspectRatio: "1 / 1",
          borderRadius: 10,
          overflow: "hidden",
          background: "#f5f5f5",
          marginBottom: 10,
        }}
      >
        {imageUrl ? (
          <Image
            src={imageUrl}
            alt={product.name}
            preview={false}
            width="100%"
            height="100%"
            loading="lazy"
            style={{ objectFit: "cover" }}
          />
        ) : (
          <div
            style={{
              width: "100%",
              height: "100%",
              display: "grid",
              placeItems: "center",
              color: "#8c8c8c",
              fontSize: 40,
            }}
          >
            📦
          </div>
        )}

        {product.stock_quantity < 5 && product.stock_quantity > 0 && (
          <Tag
            color="warning"
            style={{
              position: "absolute",
              top: 8,
              right: 8,
              margin: 0,
              fontSize: 13,
              fontWeight: 700,
              paddingInline: 8,
              paddingBlock: 2,
            }}
          >
            Còn {product.stock_quantity}
          </Tag>
        )}

        {hasDiscount && (
          <Tag
            color="error"
            style={{
              position: "absolute",
              top: 8,
              left: 8,
              margin: 0,
              fontSize: 14,
              fontWeight: 800,
              paddingInline: 10,
              paddingBlock: 2,
            }}
          >
            -{discountPercent}%
          </Tag>
        )}

        {isOutOfStock && (
          <div
            style={{
              position: "absolute",
              inset: 0,
              display: "grid",
              placeItems: "center",
              background: "rgba(0, 0, 0, 0.45)",
            }}
          >
            <Tag
              color="error"
              style={{
                margin: 0,
                fontSize: 14,
                paddingInline: 10,
                paddingBlock: 2,
              }}
            >
              Hết hàng
            </Tag>
          </div>
        )}
      </div>

      <Space
        orientation="vertical"
        size={10}
        className="w-full flex-1"
      >
        <div style={{ minHeight: 24 }}>
          <Tag color="blue" style={{ margin: 0 }}>
            {product.category}
          </Tag>
        </div>

        <div style={{ minHeight: 44 }}>
          <Typography.Text
            strong
            ellipsis={{ tooltip: product.name }}
            style={{
              display: "-webkit-box",
              WebkitLineClamp: 2,
              WebkitBoxOrient: "vertical",
              overflow: "hidden",
              fontSize: 14,
              lineHeight: 1.35,
            }}
          >
            {product.name}
          </Typography.Text>
        </div>

        <div className="mt-auto flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <div className="text-[15px] font-semibold leading-tight text-red-500 whitespace-nowrap">
              {formatCurrency(finalPrice)}
            </div>
            {hasDiscount && (
              <Space orientation="vertical" size={0} style={{ marginTop: 2 }}>
                <Typography.Text
                  delete
                  type="secondary"
                  style={{ fontSize: 12 }}
                >
                  {formatCurrency(product.price)}
                </Typography.Text>
                <Typography.Text
                  style={{ fontSize: 13, fontWeight: 700, color: "#ff4d4f" }}
                >
                  Tiết kiệm {formatCurrency(savingAmount)}
                </Typography.Text>
              </Space>
            )}
          </div>

          <Button
            type="primary"
            icon={<ShoppingCartOutlined />}
            className="w-full sm:w-auto"
            onClick={(event) => {
              event.stopPropagation();
              onAddToCart(product);
            }}
            disabled={isOutOfStock}
            style={{ borderRadius: 8 }}
          >
            Thêm
          </Button>
        </div>
      </Space>
    </Card>
  );
}
