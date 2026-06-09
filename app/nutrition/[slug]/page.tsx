"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import DOMPurify from "dompurify";
import {
  Alert,
  Button,
  Card,
  Empty,
  Space,
  Spin,
  Tag,
  Typography,
  message,
} from "antd";
import { ArrowLeftOutlined, ShoppingCartOutlined } from "@ant-design/icons";
import { Header } from "@/components/home/Header";
import { CartModal } from "@/components/home/CartModal";
import { useCart } from "@/hooks/useCart";
import { calculateDiscountedPrice, formatCurrency } from "@/lib/utils";
import type {
  NutritionArticle,
  NutritionCategory,
  Product,
} from "@/types/database";

type ArticleDetail = NutritionArticle & {
  nutrition_categories?: NutritionCategory | null;
};

export default function NutritionArticlePage() {
  const params = useParams();
  const router = useRouter();
  const [messageApi, contextHolder] = message.useMessage();
  const [article, setArticle] = useState<ArticleDetail | null>(null);
  const [relatedProducts, setRelatedProducts] = useState<Product[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const {
    cart,
    addToCart,
    updateQuantity,
    removeFromCart,
    getTotalItems,
    getTotalPrice,
  } = useCart();
  const slug = String(params.slug || "");

  useEffect(() => {
    if (!slug) return;
    fetch(`/api/nutrition/articles/${slug}`, {
      cache: "no-store",
    })
      .then(async (response) => {
        const result = await response.json();
        if (!response.ok) {
          throw new Error(result.error || "Không thể tải bài viết");
        }
        setArticle(result.article || null);
        setRelatedProducts(
          Array.isArray(result.relatedProducts) ? result.relatedProducts : [],
        );
      })
      .catch((error) => {
        console.error("Error loading nutrition article:", error);
        messageApi.error("Không thể tải bài viết");
      })
      .finally(() => setIsLoading(false));
  }, [messageApi, slug]);

  const sanitizedContent = useMemo(() => {
    return DOMPurify.sanitize(article?.content || "", {
      USE_PROFILES: { html: true },
    });
  }, [article?.content]);

  return (
    <div className="sl-public-shell">
      {contextHolder}
      <Header
        cartItemsCount={getTotalItems()}
        onCartClick={() => setIsCartOpen(true)}
      />

      <main className="max-w-5xl mx-auto px-3 sm:px-6 lg:px-8 py-4 sm:py-6 pb-36 md:pb-8">
        <Button
          icon={<ArrowLeftOutlined />}
          onClick={() => router.push("/nutrition")}
          style={{ marginBottom: 16 }}
        >
          Quay lại bài viết
        </Button>

        {isLoading ? (
          <div style={{ padding: 60, textAlign: "center" }}>
            <Spin size="large" />
          </div>
        ) : !article ? (
          <Card>
            <Empty description="Không tìm thấy bài viết" />
          </Card>
        ) : (
          <Space orientation="vertical" size={16} style={{ width: "100%" }}>
            <Card>
              <Space orientation="vertical" size={12} style={{ width: "100%" }}>
                <div>
                  {article.nutrition_categories && (
                    <Tag color="green">{article.nutrition_categories.name}</Tag>
                  )}
                  <Typography.Title
                    level={1}
                    className="sl-section-title !mb-0 !mt-2 !text-[28px] sm:!text-[38px]"
                  >
                    {article.title}
                  </Typography.Title>
                  <Typography.Text type="secondary">
                    {article.author_name ? `${article.author_name} • ` : ""}
                    {article.published_at
                      ? new Date(article.published_at).toLocaleDateString(
                          "vi-VN",
                        )
                      : new Date(article.created_at).toLocaleDateString(
                          "vi-VN",
                        )}
                  </Typography.Text>
                </div>

                {article.excerpt && (
                  <Typography.Paragraph
                    style={{ fontSize: 17, color: "#595959", marginBottom: 0 }}
                  >
                    {article.excerpt}
                  </Typography.Paragraph>
                )}

                {article.cover_image_url && (
                  <div
                    style={{
                      position: "relative",
                      aspectRatio: "16 / 8",
                      borderRadius: 12,
                      overflow: "hidden",
                      background: "#f5f5f5",
                    }}
                  >
                    <Image
                      src={article.cover_image_url}
                      alt={article.title}
                      fill
                      sizes="(max-width: 1024px) 100vw, 960px"
                      priority
                      style={{ objectFit: "cover" }}
                    />
                  </div>
                )}
              </Space>
            </Card>

            <Alert
              type="info"
              showIcon
              title="Lưu ý"
              description="Bài viết mang tính tham khảo. Với bệnh lý, thai kỳ, trẻ nhỏ hoặc chế độ ăn đặc biệt, hãy trao đổi trực tiếp với bác sĩ/chuyên gia dinh dưỡng."
            />

            <Card>
              {sanitizedContent ? (
                <div
                  style={{ lineHeight: 1.85, fontSize: 16 }}
                  className="[&_img]:max-w-full [&_img]:h-auto [&_img]:rounded-lg [&_a]:text-blue-600 [&_a]:underline [&_.sl-rte-image-wrapper]:max-w-full"
                  dangerouslySetInnerHTML={{ __html: sanitizedContent }}
                />
              ) : (
                <Typography.Text type="secondary">
                  Bài viết chưa có nội dung.
                </Typography.Text>
              )}
            </Card>

            {relatedProducts.length > 0 && (
              <Card title="Sản phẩm liên quan">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {relatedProducts.map((product) => {
                    const finalPrice = calculateDiscountedPrice(
                      product.price,
                      product.discount_percent,
                    );
                    return (
                      <div
                        key={product.id}
                        className="border rounded-lg p-3 bg-white"
                      >
                        <Link
                          href={`/products/${product.id}`}
                          style={{ textDecoration: "none", color: "inherit" }}
                        >
                          <div
                            style={{
                              position: "relative",
                              aspectRatio: "1 / 1",
                              background: "#f5f5f5",
                              borderRadius: 8,
                              overflow: "hidden",
                              marginBottom: 8,
                            }}
                          >
                            {product.image_url ? (
                              <Image
                                src={product.image_url}
                                alt={product.name}
                                fill
                                sizes="220px"
                                style={{ objectFit: "cover" }}
                              />
                            ) : null}
                          </div>
                          <Typography.Text strong>{product.name}</Typography.Text>
                          <div style={{ color: "#cf1322", fontWeight: 700 }}>
                            {formatCurrency(finalPrice)}
                          </div>
                        </Link>
                        <Button
                          type="primary"
                          icon={<ShoppingCartOutlined />}
                          block
                          style={{ marginTop: 10 }}
                          disabled={product.stock_quantity <= 0}
                          onClick={() => {
                            addToCart(product);
                            messageApi.success("Đã thêm vào giỏ hàng");
                          }}
                        >
                          Thêm vào giỏ
                        </Button>
                      </div>
                    );
                  })}
                </div>
              </Card>
            )}
          </Space>
        )}
      </main>

      <CartModal
        isOpen={isCartOpen}
        onClose={() => setIsCartOpen(false)}
        cart={cart}
        onUpdateQuantity={updateQuantity}
        onRemoveItem={removeFromCart}
        onCheckout={() => {
          setIsCartOpen(false);
          router.push("/checkout");
        }}
        totalPrice={getTotalPrice()}
      />
    </div>
  );
}
