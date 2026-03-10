"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import Image from "next/image";
import dynamic from "next/dynamic";
import { Header } from "@/components/home/Header";
import { ProductGrid } from "@/components/home/ProductGrid";
import { useCart } from "@/hooks/useCart";
import type { Product } from "@/types/database";
import { CloseOutlined, FilterOutlined } from "@ant-design/icons";
import {
  Button,
  Card,
  Carousel,
  Empty,
  Checkbox,
  Radio,
  Select,
  Space,
  Spin,
  Typography,
  message,
} from "antd";
import { useRouter } from "next/navigation";
import { trackBeginCheckout, trackSelectItem } from "@/lib/analytics";
import { getOptimizedImageUrl } from "@/lib/imageUtils";

const CartModal = dynamic(
  () =>
    import("@/components/home/CartModal").then((module) => module.CartModal),
  { ssr: false },
);

type HomeBanner = {
  image_url: string;
  alt_text: string | null;
  mime_type?: string;
  display_order?: number | null;
};

type CarouselItem = {
  image: string;
  alt: string;
  type: "image" | "video";
};

const DEFAULT_LEAD_BANNER: CarouselItem = {
  image: "/banners/banner-default-smartlife.svg",
  alt: "Rẻ Hơn Shoppe, Ngon Hơn Shopee",
  type: "image",
};

const DEFAULT_CAROUSEL_ITEMS: CarouselItem[] = [DEFAULT_LEAD_BANNER];

function HomeContent() {
  const MOBILE_PRODUCTS_STEP = 8;
  const DESKTOP_PRODUCTS_STEP = 12;
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
  const [selectedCategory, setSelectedCategory] = useState<string | undefined>(
    undefined,
  );
  const [onlyDiscounted, setOnlyDiscounted] = useState(false);
  const [carouselItems, setCarouselItems] = useState<CarouselItem[]>(
    DEFAULT_CAROUSEL_ITEMS,
  );
  const [isMobileView, setIsMobileView] = useState(false);
  const [isMobileFilterOpen, setIsMobileFilterOpen] = useState(false);
  const [visibleCount, setVisibleCount] = useState(DESKTOP_PRODUCTS_STEP);

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

  useEffect(() => {
    const mediaQuery = window.matchMedia("(max-width: 767px)");
    const updateMobileState = () => {
      setIsMobileView(mediaQuery.matches);
    };

    updateMobileState();
    mediaQuery.addEventListener("change", updateMobileState);

    return () => {
      mediaQuery.removeEventListener("change", updateMobileState);
    };
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

      const mapped: CarouselItem[] = banners
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
          image: getOptimizedImageUrl(item.image_url, {
            width: 1600,
            quality: 72,
            format: "webp",
          }),
          alt: item.alt_text || `Banner trang chủ ${index + 1}`,
          type: item.mime_type?.startsWith("video/") ? "video" : "image",
        }));

      if (mapped.length > 0) {
        setCarouselItems([
          DEFAULT_LEAD_BANNER,
          ...mapped.filter((item) => item.image !== DEFAULT_LEAD_BANNER.image),
        ]);
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

  const categoryOptions = useMemo(() => {
    const grouped = new Map<string, number>();
    products.forEach((item) => {
      grouped.set(item.category, (grouped.get(item.category) || 0) + 1);
    });

    return Array.from(grouped.entries())
      .sort((first, second) => first[0].localeCompare(second[0], "vi"))
      .map(([category, count]) => ({
        label: `${category} (${count})`,
        value: category,
      }));
  }, [products]);

  const filteredProducts = useMemo(() => {
    return products.filter((item) => {
      if (selectedCategory && item.category !== selectedCategory) {
        return false;
      }

      if (onlyDiscounted && Number(item.discount_percent || 0) <= 0) {
        return false;
      }

      return true;
    });
  }, [onlyDiscounted, products, selectedCategory]);

  const visibleProducts = useMemo(() => {
    const getFinalPrice = (item: Product) =>
      item.price * (1 - (item.discount_percent || 0) / 100);

    const cloned = [...filteredProducts];

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
  }, [filteredProducts, priceSort, sortType]);

  const productsStep = isMobileView
    ? MOBILE_PRODUCTS_STEP
    : DESKTOP_PRODUCTS_STEP;

  const hasMoreProducts = visibleProducts.length > visibleCount;

  useEffect(() => {
    setVisibleCount(productsStep);
  }, [productsStep, selectedCategory, onlyDiscounted, sortType, priceSort]);

  const displayedProducts = useMemo(() => {
    return visibleProducts.slice(0, visibleCount);
  }, [visibleCount, visibleProducts]);

  const resetFilters = () => {
    setSelectedCategory(undefined);
    setOnlyDiscounted(false);
    setPriceSort(undefined);
    setSortType("popular");
  };

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
          className="hidden md:block"
          style={{ marginBottom: 24, padding: 0 }}
          styles={{ body: { padding: 0 } }}
        >
          <Carousel autoplay dots infinite>
            {carouselItems.map((item) => (
              <div key={item.image}>
                <div
                  style={{
                    width: "100%",
                    overflow: "hidden",
                    borderRadius: 8,
                    aspectRatio: "16 / 6.5", // Increased height for banner
                    background: "#f5f5f5",
                    position: "relative",
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
                    <Image
                      src={item.image}
                      alt={item.alt}
                      fill
                      priority={item === carouselItems[0]}
                      sizes="(max-width: 768px) 100vw, 1200px"
                      style={{
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

        <Card
          className="hidden md:block"
          style={{ marginBottom: 16, background: "#fafafa" }}
        >
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
            <Select
              allowClear
              placeholder="Danh mục"
              value={selectedCategory}
              onChange={(value) => setSelectedCategory(value)}
              style={{ minWidth: 220 }}
              options={categoryOptions}
            />
            <Checkbox
              checked={onlyDiscounted}
              onChange={(event) => setOnlyDiscounted(event.target.checked)}
            >
              Đang giảm giá
            </Checkbox>
          </Space>
        </Card>

        <div className="md:hidden mb-3 flex justify-end">
          <Button
            type={isMobileFilterOpen ? "primary" : "default"}
            icon={isMobileFilterOpen ? <CloseOutlined /> : <FilterOutlined />}
            onClick={() => setIsMobileFilterOpen((prev) => !prev)}
          >
            {isMobileFilterOpen ? "Đóng lọc" : "Bộ lọc"}
          </Button>
        </div>

        {isMobileFilterOpen && (
          <Card
            className="md:hidden"
            style={{ marginBottom: 12, background: "#fafafa" }}
          >
            <Space orientation="vertical" size={10} style={{ width: "100%" }}>
              <Typography.Text type="secondary">
                Bộ lọc sản phẩm
              </Typography.Text>

              <Select
                value={sortType}
                onChange={(value) => setSortType(value)}
                style={{ width: "100%" }}
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
                style={{ width: "100%" }}
                options={[
                  { label: "Giá: Thấp đến cao", value: "asc" },
                  { label: "Giá: Cao đến thấp", value: "desc" },
                ]}
              />

              <Select
                allowClear
                placeholder="Danh mục"
                value={selectedCategory}
                onChange={(value) => setSelectedCategory(value)}
                style={{ width: "100%" }}
                options={categoryOptions}
              />

              <Space
                size={8}
                style={{ width: "100%", justifyContent: "space-between" }}
              >
                <Button onClick={resetFilters}>Xóa lọc</Button>
                <Button
                  type={onlyDiscounted ? "primary" : "default"}
                  onClick={() => setOnlyDiscounted((prev) => !prev)}
                >
                  Đang giảm giá
                </Button>
              </Space>
            </Space>
          </Card>
        )}

        {/* Product Grid */}
        <ProductGrid
          products={displayedProducts}
          onAddToCart={handleAddToCart}
          onViewDetail={handleViewDetail}
        />

        {hasMoreProducts && (
          <div className="mt-4 flex justify-center py-2">
            <Button
              type="primary"
              onClick={() =>
                setVisibleCount((prev) =>
                  Math.min(prev + productsStep, visibleProducts.length),
                )
              }
            >
              Hiển thị thêm
            </Button>
          </div>
        )}

        {/* Empty State */}
        {visibleProducts.length === 0 && (
          <Card style={{ marginTop: 16 }}>
            <Empty
              description="Không có sản phẩm phù hợp bộ lọc"
              image={Empty.PRESENTED_IMAGE_SIMPLE}
            >
              <Button type="primary" onClick={resetFilters}>
                Xóa bộ lọc
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
