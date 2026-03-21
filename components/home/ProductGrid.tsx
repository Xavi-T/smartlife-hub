"use client";

import { Col, Empty, Row } from "antd";
import { ProductCard } from "./ProductCard";
import type { Product } from "@/types/database";

interface ProductGridProps {
  products: Product[];
  onAddToCart: (product: Product) => void;
  onViewDetail: (product: Product) => void;
}

export function ProductGrid({
  products,
  onAddToCart,
  onViewDetail,
}: ProductGridProps) {
  if (products.length === 0) {
    return (
      <div style={{ padding: "32px 0" }}>
        <Empty description="Không có sản phẩm nào" />
      </div>
    );
  }

  return (
    <Row gutter={[12, 12]} align="stretch">
      {products.map((product) => (
        <Col
          key={product.id}
          xs={12}
          sm={12}
          md={8}
          lg={6}
          style={{ display: "flex" }}
        >
          <ProductCard
            product={product}
            onAddToCart={onAddToCart}
            onViewDetail={onViewDetail}
          />
        </Col>
      ))}
    </Row>
  );
}
