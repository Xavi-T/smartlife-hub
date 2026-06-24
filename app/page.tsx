"use client";

import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
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
  Input,
  Radio,
  Select,
  Space,
  Spin,
  Tag,
  Typography,
  message,
} from "antd";
import { useRouter } from "next/navigation";
import { trackBeginCheckout, trackSelectItem } from "@/lib/analytics";
import { getOptimizedImageUrl } from "@/lib/imageUtils";
import { APP_CONFIG } from "@/lib/appConfig";
import { isPriceOnRequestProduct } from "@/lib/productPricing";

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

const DEFAULT_CAROUSEL_ITEMS: CarouselItem[] = [
  {
    image: "/banners/banner-nutrition-consulting.svg",
    alt: "Tư vấn dinh dưỡng cá nhân tại SmartLife Hub",
    type: "image",
  },
  {
    image: "/banners/banner-family-health.svg",
    alt: "Giải pháp dinh dưỡng cho tương lai khoẻ",
    type: "image",
  },
  {
    image: "/banners/banner-mom-baby-milk.svg",
    alt: "Sữa mẹ bầu và trẻ em",
    type: "image",
  },
  {
    image: "/banners/banner-healthy-products.svg",
    alt: "Gian hàng dinh dưỡng lành mạnh",
    type: "image",
  },
];
const CLIENT_CACHE_TTL_MS = 2 * 60 * 1000;
const MOBILE_PRODUCTS_STEP = 8;
const DESKTOP_PRODUCTS_STEP = 12;
const MOBILE_MEDIA_QUERY = "(max-width: 767px)";
const DEPRECATED_BANNER_PATH = "/banners/banner-default-smartlife.svg";

const normalizeText = (value: string | null | undefined) =>
  (value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .toLowerCase()
    .trim();

let cachedProducts: Product[] | null = null;
let cachedProductsAt = 0;
let cachedCarouselItems: CarouselItem[] | null = null;
let cachedCarouselAt = 0;

function isCacheFresh(timestamp: number) {
  return Date.now() - timestamp < CLIENT_CACHE_TTL_MS;
}

function getBannerImageKey(image: string) {
  try {
    return new URL(image, "http://smartlife.local").pathname;
  } catch {
    return image.split("?")[0] || image;
  }
}

const DEFAULT_BANNER_IMAGE_KEYS = new Set(
  DEFAULT_CAROUSEL_ITEMS.map((item) => getBannerImageKey(item.image)),
);

function toCarouselItems(banners: HomeBanner[]): CarouselItem[] {
  return banners
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
}

function mergeCarouselItems(items: CarouselItem[]) {
  const seen = new Set(DEFAULT_BANNER_IMAGE_KEYS);
  const customItems = items.filter((item) => {
    const key = getBannerImageKey(item.image);
    if (key.endsWith(DEPRECATED_BANNER_PATH) || seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  return [...DEFAULT_CAROUSEL_ITEMS, ...customItems];
}

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
  const [selectedCategory, setSelectedCategory] = useState<string | undefined>(
    undefined,
  );
  const [searchQuery, setSearchQuery] = useState("");
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

  const fetchProducts = useCallback(async (signal?: AbortSignal) => {
    if (cachedProducts && isCacheFresh(cachedProductsAt)) {
      setProducts(cachedProducts);
      setIsLoading(false);
      return;
    }

    try {
      const res = await fetch("/api/products?activeOnly=true", { signal });
      if (!res.ok) throw new Error("Failed to fetch products");
      const data = await res.json();
      if (signal?.aborted) return;
      const activeProducts = data.filter((p: Product) => p.is_active);
      cachedProducts = activeProducts;
      cachedProductsAt = Date.now();
      setProducts(activeProducts);
    } catch (error) {
      if (!signal?.aborted) {
        console.error("Error fetching products:", error);
      }
    } finally {
      if (!signal?.aborted) {
        setIsLoading(false);
      }
    }
  }, []);

  const fetchHomepageBanners = useCallback(async (signal?: AbortSignal) => {
    if (cachedCarouselItems && isCacheFresh(cachedCarouselAt)) {
      setCarouselItems(cachedCarouselItems);
      return;
    }

    try {
      const response = await fetch("/api/media?purpose=homepage_banner", {
        signal,
      });

      if (!response.ok) return;

      const result = await response.json();
      if (signal?.aborted) return;
      const banners = (
        Array.isArray(result.media) ? result.media : []
      ) as HomeBanner[];

      if (banners.length === 0) return;

      const mapped = toCarouselItems(banners);
      if (mapped.length > 0) {
        const nextCarouselItems = mergeCarouselItems(mapped);
        cachedCarouselItems = nextCarouselItems;
        cachedCarouselAt = Date.now();
        setCarouselItems(nextCarouselItems);
      }
    } catch (error) {
      if (!signal?.aborted) {
        console.error("Error fetching homepage banners:", error);
      }
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    fetchProducts(controller.signal);
    fetchHomepageBanners(controller.signal);

    return () => {
      controller.abort();
    };
  }, [fetchHomepageBanners, fetchProducts]);

  useEffect(() => {
    const mediaQuery = window.matchMedia(MOBILE_MEDIA_QUERY);
    const updateMobileState = () => {
      setIsMobileView(mediaQuery.matches);
    };

    updateMobileState();
    mediaQuery.addEventListener("change", updateMobileState);

    return () => {
      mediaQuery.removeEventListener("change", updateMobileState);
    };
  }, []);

  const handleAddToCart = (product: Product) => {
    if (isPriceOnRequestProduct(product)) {
      window.open(APP_CONFIG.socials.zalo, "_blank", "noopener");
      return;
    }

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

  const searchableProducts = useMemo(
    () =>
      products.map((item) => ({
        product: item,
        searchIndex: normalizeText(
          `${item.name} ${item.category} ${item.description || ""}`,
        ),
      })),
    [products],
  );

  const filteredProducts = useMemo(() => {
    const normalizedQuery = normalizeText(searchQuery);

    return searchableProducts
      .filter(({ product, searchIndex }) => {
        const item = product;

        if (selectedCategory && item.category !== selectedCategory) {
          return false;
        }

        if (onlyDiscounted && Number(item.discount_percent || 0) <= 0) {
          return false;
        }

        if (normalizedQuery) {
          if (!searchIndex.includes(normalizedQuery)) {
            return false;
          }
        }

        return true;
      })
      .map(({ product }) => product);
  }, [onlyDiscounted, searchQuery, searchableProducts, selectedCategory]);

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
  }, [
    productsStep,
    selectedCategory,
    searchQuery,
    onlyDiscounted,
    sortType,
    priceSort,
  ]);

  const displayedProducts = useMemo(() => {
    return visibleProducts.slice(0, visibleCount);
  }, [visibleCount, visibleProducts]);

  const resetFilters = () => {
    setSelectedCategory(undefined);
    setSearchQuery("");
    setOnlyDiscounted(false);
    setPriceSort(undefined);
    setSortType("popular");
  };

  if (isLoading || !isLoaded) {
    return (
      <div className="sl-public-shell grid place-items-center">
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
    <div className="sl-public-shell">
      {contextHolder}

      {/* Header */}
      <Header
        cartItemsCount={getTotalItems()}
        onCartClick={() => setIsCartOpen(true)}
      />

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-4 md:py-8 pb-36 md:pb-8">
        <section className="sl-hero sl-animate-in mb-5 rounded-2xl p-4 sm:p-6 xl:p-8">
          <div className="sl-hero-content grid grid-cols-1 items-center gap-5 xl:grid-cols-[minmax(360px,0.78fr)_minmax(680px,1.22fr)]">
            <div className="space-y-4">
              <div className="sl-brand-pill px-3 py-2 text-sm font-semibold">
                <Image
                  src="/logoSH.png"
                  alt="SmartLife Hub"
                  width={26}
                  height={26}
                  className="rounded-md object-contain"
                />
                SmartLife Hub
              </div>
              <div>
                <Typography.Title
                  level={1}
                  className="sl-section-title !mb-3 !text-[32px] sm:!text-[44px] xl:!text-[50px]"
                >
                  {APP_CONFIG.shopTagline}
                </Typography.Title>
                <Typography.Paragraph
                  className="!mb-0 !text-base sm:!text-lg"
                  style={{ color: "var(--sl-muted)", maxWidth: 620 }}
                >
                  Tư vấn dinh dưỡng, tính nhu cầu calo và chọn sản phẩm phù hợp
                  cho gia đình với phong cách sạch, ấm và gần gũi.
                </Typography.Paragraph>
              </div>
              <div className="flex flex-wrap gap-2">
                {["Dinh dưỡng gia đình", "Tính calo", "Sản phẩm phù hợp"].map(
                  (item) => (
                    <Tag
                      key={item}
                      color="green"
                      className="!m-0 !rounded-full !px-3 !py-1"
                    >
                      {item}
                    </Tag>
                  ),
                )}
              </div>
              <div className="flex flex-col gap-3 sm:flex-row">
                <Button
                  type="primary"
                  size="large"
                  onClick={() => router.push("/nutrition/calculator")}
                >
                  Tính nhu cầu dinh dưỡng
                </Button>
                <Button
                  size="large"
                  onClick={() => router.push("/nutrition")}
                  style={{ borderColor: "rgba(22, 139, 208, 0.32)" }}
                >
                  Đọc kiến thức dinh dưỡng
                </Button>
              </div>
            </div>

            <div className="sl-hero-media hidden md:block">
              <Carousel autoplay dots infinite>
                {carouselItems.map((item) => (
                  <div key={item.image}>
                    <div
                      style={{
                        width: "100%",
                        overflow: "hidden",
                        aspectRatio: "1600 / 650",
                        background:
                          "linear-gradient(135deg, #fffaf0, #f4fbf3)",
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
                            objectFit: "contain",
                          }}
                        />
                      ) : (
                        <Image
                          src={item.image}
                          alt={item.alt}
                          fill
                          priority={item === carouselItems[0]}
                          sizes="(max-width: 1279px) 100vw, 760px"
                          style={{
                            display: "block",
                            objectFit: "contain",
                          }}
                        />
                      )}
                    </div>
                  </div>
                ))}
              </Carousel>
            </div>
          </div>
        </section>

        <Card
          className="sl-animate-in sl-animate-delay-1 hidden md:block"
          style={{ marginBottom: 16, background: "rgba(255,255,255,0.86)" }}
        >
          <Space wrap size={12} style={{ width: "100%" }}>
            <Input.Search
              allowClear
              placeholder="Tìm sản phẩm theo tên, mô tả, danh mục"
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              style={{ minWidth: 320 }}
            />
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

        <div className="sl-animate-in sl-animate-delay-1 md:hidden mb-3">
          <Input.Search
            allowClear
            placeholder="Tìm theo tên, mô tả, danh mục"
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
          />
        </div>

        <div className="md:hidden mb-3 flex justify-end">
          <Button
            type={isMobileFilterOpen ? "primary" : "default"}
            icon={isMobileFilterOpen ? <CloseOutlined /> : <FilterOutlined />}
            onClick={() => setIsMobileFilterOpen((prev) => !prev)}
            size="middle"
          >
            {isMobileFilterOpen ? "Đóng lọc" : "Bộ lọc"}
          </Button>
        </div>

        {isMobileFilterOpen && (
          <Card
            className="md:hidden"
            style={{ marginBottom: 12, background: "rgba(255,255,255,0.9)" }}
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
        <section className="sl-animate-in sl-animate-delay-2">
          <div className="mb-3 flex items-end justify-between gap-3">
            <div>
              <Typography.Title
                level={3}
                className="sl-section-title !mb-1 !text-2xl sm:!text-3xl"
              >
                Sản phẩm dinh dưỡng & chăm sóc sức khỏe
              </Typography.Title>
              <Typography.Text type="secondary">
                {visibleProducts.length} sản phẩm phù hợp
              </Typography.Text>
            </div>
          </div>
          <ProductGrid
            products={displayedProducts}
            onAddToCart={handleAddToCart}
            onViewDetail={handleViewDetail}
          />
        </section>

        {hasMoreProducts && (
          <div className="mt-4 flex justify-center py-1 md:py-2">
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
        <div className="sl-public-shell grid place-items-center">
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
