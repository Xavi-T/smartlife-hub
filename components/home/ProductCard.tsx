"use client";

import NextImage from "next/image";
import { Button, Card, Tag, Typography } from "antd";
import { ShoppingCartOutlined } from "@ant-design/icons";
import {
  calculateDiscountedPrice,
  formatCurrency,
  getEffectiveDiscountPercent,
} from "@/lib/utils";
import type { Product } from "@/types/database";
import { getOptimizedImageUrl } from "@/lib/imageUtils";

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
  const imageUrl = product.image_url
    ? getOptimizedImageUrl(product.image_url, {
        width: 640,
        quality: 72,
        format: "webp",
      })
    : undefined;

  return (
    <Card
      className="sl-product-card"
      hoverable={!isOutOfStock}
      styles={{
        body: {
          padding: 10,
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
          marginBottom: 6,
        }}
        className="sl-product-image"
      >
        {imageUrl ? (
          <NextImage
            src={imageUrl}
            alt={product.name}
            fill
            sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
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

      <div className="flex min-h-0 flex-1 flex-col">
        <div className="mb-1 overflow-hidden leading-none">
          <Tag
            color="green"
            style={{
              margin: 0,
              maxWidth: "100%",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
              fontSize: 13,
              lineHeight: 1.25,
              paddingInline: 8,
              paddingBlock: 2,
            }}
          >
            {product.category}
          </Tag>
        </div>

        <div className="mb-2 min-h-[39px] overflow-hidden">
          <Typography.Text
            strong
            ellipsis={{ tooltip: product.name }}
            style={{
              display: "-webkit-box",
              WebkitLineClamp: 2,
              WebkitBoxOrient: "vertical",
              overflow: "hidden",
              fontSize: 15,
              lineHeight: 1.28,
            }}
          >
            {product.name}
          </Typography.Text>
        </div>

        <div className="min-h-[45px] min-w-0">
          <div className="text-[18px] font-semibold leading-tight text-red-500 whitespace-nowrap sm:text-[20px]">
            {formatCurrency(finalPrice)}
          </div>
          {hasDiscount && (
            <div className="mt-1 flex min-w-0 items-center gap-2 overflow-hidden leading-none">
              <Typography.Text delete type="secondary" style={{ fontSize: 13 }}>
                {formatCurrency(product.price)}
              </Typography.Text>
              <span className="hidden min-w-0 truncate text-[12px] font-semibold leading-none text-red-500 sm:inline">
                Tiết kiệm {formatCurrency(savingAmount)}
              </span>
            </div>
          )}
        </div>

        <div className="mt-auto pt-2">
          <Button
            type="primary"
            icon={<ShoppingCartOutlined />}
            className="h-10 w-full"
            onClick={(event) => {
              event.stopPropagation();
              onAddToCart(product);
            }}
            disabled={isOutOfStock}
            style={{ borderRadius: 12 }}
          >
            Thêm
          </Button>
        </div>
      </div>
    </Card>
  );
}
