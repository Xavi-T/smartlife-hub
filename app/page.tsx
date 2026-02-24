"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { Header } from "@/components/home/Header";
import { ProductGrid } from "@/components/home/ProductGrid";
import { CartModal } from "@/components/home/CartModal";
import { useCart } from "@/hooks/useCart";
import type { Product } from "@/types/database";
import {
  Button,
  Card,
  Carousel,
  Empty,
  Radio,
  Select,
  Space,
  Spin,
  Typography,
  message,
} from "antd";
import { useRouter } from "next/navigation";
import { trackBeginCheckout, trackSelectItem } from "@/lib/analytics";

type HomeBanner = {
  image_url: string;
  alt_text: string | null;
  mime_type?: string;
  display_order?: number | null;
};

const DEFAULT_CAROUSEL_ITEMS = [
  { image: "/banners/banner-1.svg", alt: "Ưu đãi gia dụng", type: "image" },
  {
    image: "/banners/banner-2.svg",
    alt: "Mua sắm nhanh chóng",
    type: "image",
  },
  {
    image: "/banners/banner-3.svg",
    alt: "Chính hãng giá tốt",
    type: "image",
  },
  { image: "/banners/banner-1.svg", alt: "Ưu đãi gia dụng", type: "image" },
  {
    image: "/banners/banner-2.svg",
    alt: "Mua sắm nhanh chóng",
    type: "image",
  },
  {
    image: "/banners/banner-3.svg",
    alt: "Chính hãng giá tốt",
    type: "image",
  },
];

function HomeContent() {
  const router = useRouter();
  const [messageApi, contextHolder] = message.useMessage();
  const [products, setProducts] = useState<Product[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [sortType, setSortType] = useState<"popular" | "newest" | "bestseller">(
    "popular",
  );
  const [priceSort, setPriceSort] = useState<"asc" | "desc" | undefined>(
    undefined,
  );
  const [carouselItems, setCarouselItems] = useState(DEFAULT_CAROUSEL_ITEMS);

  const {
    cart,
    addToCart,
    updateQuantity,
    removeFromCart,
    getTotalItems,
    getTotalPrice,
    isLoaded,
  } = useCart();

  // Fetch products
  useEffect(() => {
    fetchProducts();
    fetchHomepageBanners();
  }, []);

  const fetchProducts = async () => {
    try {
      const res = await fetch("/api/products");
      if (!res.ok) throw new Error("Failed to fetch products");
      const data = await res.json();
      // Chỉ hiển thị sản phẩm đang hoạt động
      setProducts(data.filter((p: Product) => p.is_active));
    } catch (error) {
      console.error("Error fetching products:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchHomepageBanners = async () => {
    try {
      const response = await fetch("/api/media?purpose=homepage_banner", {
        cache: "no-store",
      });

      if (!response.ok) return;

      const result = await response.json();
      const banners = (
        Array.isArray(result.media) ? result.media : []
      ) as HomeBanner[];

      if (banners.length === 0) return;

      const mapped = banners
        .filter((item) => item.image_url)
        .sort((a, b) => {
          const orderA =
            typeof a.display_order === "number"
              ? a.display_order
              : Number.MAX_SAFE_INTEGER;
          const orderB =
            typeof b.display_order === "number"
              ? b.display_order
              : Number.MAX_SAFE_INTEGER;
          return orderA - orderB;
        })
        .map((item, index) => ({
          image: item.image_url,
          alt: item.alt_text || `Banner trang chủ ${index + 1}`,
          type: item.mime_type?.startsWith("video/") ? "video" : "image",
        }));

      if (mapped.length > 0) {
        setCarouselItems(mapped);
      }
    } catch {
      // Keep fallback carousel items
    }
  };

  const handleAddToCart = (product: Product) => {
    addToCart(product);
    messageApi.success(`${product.name} đã được thêm vào giỏ hàng`);
  };

  const handleCheckout = () => {
    trackBeginCheckout(cart);
    setIsCartOpen(false);
    router.push("/checkout");
  };

  const handleViewDetail = (product: Product) => {
    trackSelectItem(product, "home_product_grid");
    router.push(`/products/${product.id}`);
  };

  const sortedProducts = useMemo(() => {
    const getFinalPrice = (item: Product) =>
      item.price * (1 - (item.discount_percent || 0) / 100);

    const cloned = [...products];

    if (priceSort) {
      return cloned.sort((a, b) => {
        const aPrice = getFinalPrice(a);
        const bPrice = getFinalPrice(b);
        return priceSort === "asc" ? aPrice - bPrice : bPrice - aPrice;
      });
    }

    if (sortType === "newest") {
      return cloned.sort(
        (a, b) =>
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
      );
    }

    if (sortType === "bestseller") {
      return cloned.sort((a, b) => {
        const stockDiff = a.stock_quantity - b.stock_quantity;
        if (stockDiff !== 0) return stockDiff;
        return (b.discount_percent || 0) - (a.discount_percent || 0);
      });
    }

    return cloned.sort(
      (a, b) =>
        new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime(),
    );
  }, [products, priceSort, sortType]);

  if (isLoading || !isLoaded) {
    return (
      <div className="min-h-screen bg-gray-50 grid place-items-center">
        <Space orientation="vertical" align="center" size="middle">
          <Spin size="large" />
          <Typography.Text type="secondary">
            Đang tải sản phẩm...
          </Typography.Text>
        </Space>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {contextHolder}

      {/* Header */}
      <Header
        cartItemsCount={getTotalItems()}
        onCartClick={() => setIsCartOpen(true)}
      />

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Card
          style={{ marginBottom: 24, padding: 0 }}
          styles={{ body: { padding: 0 } }}
        >
          <Carousel autoplay dots>
            {carouselItems.map((item) => (
              <div key={item.image}>
                <div
                  style={{
                    width: "100%",
                    overflow: "hidden",
                    borderRadius: 8,
                    aspectRatio: "16 / 6.5", // Increased height for banner
                    background: "#f5f5f5",
                  }}
                >
                  {item.type === "video" ? (
                    <video
                      src={item.image}
                      autoPlay
                      muted
                      loop
                      playsInline
                      style={{
                        width: "100%",
                        height: "100%",
                        display: "block",
                        objectFit: "cover",
                      }}
                    />
                  ) : (
                    <img
                      src={item.image}
                      alt={item.alt}
                      style={{
                        width: "100%",
                        height: "100%",
                        display: "block",
                        objectFit: "cover",
                      }}
                    />
                  )}
                </div>
              </div>
            ))}
          </Carousel>
        </Card>

        <Card style={{ marginBottom: 16, background: "#fafafa" }}>
          <Space wrap size={12} style={{ width: "100%" }}>
            <Typography.Text type="secondary">Sắp xếp theo</Typography.Text>
            <Radio.Group
              optionType="button"
              buttonStyle="solid"
              value={sortType}
              onChange={(event) => setSortType(event.target.value)}
              options={[
                { label: "Phổ Biến", value: "popular" },
                { label: "Mới Nhất", value: "newest" },
                { label: "Bán Chạy", value: "bestseller" },
              ]}
            />
            <Select
              allowClear
              placeholder="Giá"
              value={priceSort}
              onChange={(value) => setPriceSort(value)}
              style={{ minWidth: 180 }}
              options={[
                { label: "Giá: Thấp đến cao", value: "asc" },
                { label: "Giá: Cao đến thấp", value: "desc" },
              ]}
            />
          </Space>
        </Card>

        {/* Product Grid */}
        <ProductGrid
          products={sortedProducts}
          onAddToCart={handleAddToCart}
          onViewDetail={handleViewDetail}
        />

        {/* Empty State */}
        {products.length === 0 && (
          <Card style={{ marginTop: 16 }}>
            <Empty
              description="Chưa có sản phẩm nào"
              image={Empty.PRESENTED_IMAGE_SIMPLE}
            >
              <Button type="primary" onClick={fetchProducts}>
                Tải lại
              </Button>
            </Empty>
          </Card>
        )}
      </main>

      {/* Cart Modal */}
      <CartModal
        isOpen={isCartOpen}
        onClose={() => setIsCartOpen(false)}
        cart={cart}
        onUpdateQuantity={updateQuantity}
        onRemoveItem={removeFromCart}
        onCheckout={handleCheckout}
        totalPrice={getTotalPrice()}
      />
    </div>
  );
}

export default function Home() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-gray-50 grid place-items-center">
          <Space orientation="vertical" align="center" size="middle">
            <Spin size="large" />
            <Typography.Text type="secondary">Đang tải...</Typography.Text>
          </Space>
        </div>
      }
    >
      <HomeContent />
    </Suspense>
  );
}
