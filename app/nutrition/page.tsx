"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Alert,
  Button,
  Card,
  Empty,
  Input,
  Select,
  Space,
  Spin,
  Tag,
  Typography,
} from "antd";
import { CalculatorOutlined } from "@ant-design/icons";
import { Header } from "@/components/home/Header";
import { CartModal } from "@/components/home/CartModal";
import { useCart } from "@/hooks/useCart";
import type { NutritionArticle, NutritionCategory } from "@/types/database";

type ArticleListItem = Pick<
  NutritionArticle,
  | "id"
  | "title"
  | "slug"
  | "excerpt"
  | "cover_image_url"
  | "author_name"
  | "published_at"
  | "created_at"
> & {
  nutrition_categories?: NutritionCategory | null;
};

function NutritionContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [articles, setArticles] = useState<ArticleListItem[]>([]);
  const [categories, setCategories] = useState<NutritionCategory[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");
  const [search, setSearch] = useState(searchParams.get("search") || "");
  const [category, setCategory] = useState(searchParams.get("category") || "");
  const [isCartOpen, setIsCartOpen] = useState(false);
  const {
    cart,
    updateQuantity,
    removeFromCart,
    getTotalItems,
    getTotalPrice,
  } = useCart();

  useEffect(() => {
    const query = new URLSearchParams();
    if (search.trim()) query.set("search", search.trim());
    if (category) query.set("category", category);

    fetch(`/api/nutrition/articles?${query.toString()}`, {
      cache: "no-store",
    })
      .then(async (response) => {
        const result = await response.json();
        if (!response.ok) {
          throw new Error(result.error || "Không thể tải bài viết");
        }
        setErrorMessage("");
        setArticles(Array.isArray(result.articles) ? result.articles : []);
        setCategories(
          Array.isArray(result.categories) ? result.categories : [],
        );
      })
      .catch((error) => {
        console.error("Error loading nutrition articles:", error);
        setErrorMessage(
          error instanceof Error ? error.message : "Không thể tải bài viết",
        );
        setArticles([]);
      })
      .finally(() => setIsLoading(false));
  }, [category, search]);

  const categoryOptions = useMemo(
    () => [
      { label: "Tất cả chủ đề", value: "" },
      ...categories.map((item) => ({
        label: item.name,
        value: item.slug,
      })),
    ],
    [categories],
  );

  const updateUrl = (nextSearch: string, nextCategory: string) => {
    const query = new URLSearchParams();
    if (nextSearch.trim()) query.set("search", nextSearch.trim());
    if (nextCategory) query.set("category", nextCategory);
    const suffix = query.toString() ? `?${query.toString()}` : "";
    router.replace(`/nutrition${suffix}`);
  };

  return (
    <div className="sl-public-shell">
      <Header
        cartItemsCount={getTotalItems()}
        onCartClick={() => setIsCartOpen(true)}
      />

      <main className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-4 sm:py-6 pb-24 md:pb-8">
        <div className="sl-animate-in mb-5">
          <Typography.Title
            level={1}
            className="sl-section-title !mb-0 !text-[28px] sm:!text-[38px]"
          >
            Dinh dưỡng cùng SmartLife Hub
          </Typography.Title>
          <Typography.Paragraph
            type="secondary"
            style={{ marginTop: 8, maxWidth: 760 }}
          >
            Chia sẻ kiến thức ăn uống lành mạnh, theo dõi sức khỏe và lựa chọn
            sản phẩm phù hợp hơn cho gia đình.
          </Typography.Paragraph>
        </div>

        <Alert
          className="sl-animate-in sl-animate-delay-1"
          type="info"
          showIcon
          style={{ marginBottom: 16 }}
          title="Thông tin tham khảo"
          description="Nội dung trên website hỗ trợ giáo dục sức khỏe, không thay thế tư vấn trực tiếp từ bác sĩ hoặc chuyên gia dinh dưỡng."
        />

        <Card
          className="sl-animate-in sl-animate-delay-1"
          style={{ marginBottom: 16 }}
          styles={{ body: { padding: 16 } }}
        >
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <Typography.Title level={4} style={{ margin: 0 }}>
                Tự tính nhu cầu dinh dưỡng
              </Typography.Title>
              <Typography.Text type="secondary">
                Ước tính BMI, calo mục tiêu và macro gợi ý cho bản thân.
              </Typography.Text>
            </div>
            <Button
              type="primary"
              icon={<CalculatorOutlined />}
              onClick={() => router.push("/nutrition/calculator")}
              className="w-full sm:w-auto"
            >
              Mở công cụ tính
            </Button>
          </div>
        </Card>

        <Card
          className="sl-animate-in sl-animate-delay-2"
          style={{ marginBottom: 16 }}
          styles={{ body: { padding: 16 } }}
        >
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-[minmax(0,420px)_minmax(180px,260px)]">
            <Input.Search
              allowClear
              placeholder="Tìm bài viết theo tiêu đề"
              value={search}
              onChange={(event) => {
                const value = event.target.value;
                setSearch(value);
                updateUrl(value, category);
              }}
              style={{ width: "100%" }}
            />
            <Select
              value={category}
              onChange={(value) => {
                setCategory(value);
                updateUrl(search, value);
              }}
              options={categoryOptions}
              style={{ width: "100%" }}
            />
          </div>
        </Card>

        {errorMessage ? (
          <Alert
            type="error"
            showIcon
            style={{ marginBottom: 16 }}
            title="Không thể tải bài viết"
            description={errorMessage}
          />
        ) : null}

        {isLoading ? (
          <div style={{ padding: 40, textAlign: "center" }}>
            <Spin size="large" />
          </div>
        ) : articles.length === 0 ? (
          <Card>
            <Empty description="Chưa có bài viết phù hợp" />
          </Card>
        ) : (
          <div className="sl-animate-in sl-animate-delay-3 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {articles.map((article) => (
              <Link
                key={article.id}
                href={`/nutrition/${article.slug}`}
                style={{ textDecoration: "none" }}
              >
                <Card
                  hoverable
                  style={{ height: "100%", overflow: "hidden" }}
                  styles={{ body: { padding: 16 } }}
                  cover={
                    <div
                      style={{
                        position: "relative",
                        aspectRatio: "16 / 9",
                        background: "#f5f5f5",
                      }}
                    >
                      {article.cover_image_url ? (
                        <Image
                          src={article.cover_image_url}
                          alt={article.title}
                          fill
                          sizes="(max-width: 768px) 100vw, 33vw"
                          style={{ objectFit: "cover" }}
                        />
                      ) : (
                        <div className="w-full h-full grid place-items-center text-gray-400">
                          Dinh dưỡng
                        </div>
                      )}
                    </div>
                  }
                >
                  <Space orientation="vertical" size={8} style={{ width: "100%" }}>
                    {article.nutrition_categories && (
                      <Tag color="green" style={{ width: "fit-content" }}>
                        {article.nutrition_categories.name}
                      </Tag>
                    )}
                    <Typography.Title
                      level={4}
                      className="!mb-0 !text-lg sm:!text-xl"
                    >
                      {article.title}
                    </Typography.Title>
                    <Typography.Paragraph
                      type="secondary"
                      ellipsis={{ rows: 3 }}
                      style={{ marginBottom: 0 }}
                    >
                      {article.excerpt || "Bài chia sẻ kiến thức dinh dưỡng."}
                    </Typography.Paragraph>
                    <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                      {article.published_at
                        ? new Date(article.published_at).toLocaleDateString(
                            "vi-VN",
                          )
                        : new Date(article.created_at).toLocaleDateString(
                            "vi-VN",
                          )}
                    </Typography.Text>
                  </Space>
                </Card>
              </Link>
            ))}
          </div>
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

export default function NutritionPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-gray-50 grid place-items-center">
          <Spin size="large" />
        </div>
      }
    >
      <NutritionContent />
    </Suspense>
  );
}
