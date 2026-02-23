"use client";

import { useEffect, useMemo, useState } from "react";
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

export default function Home() {
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

  const handleAddToCart = (product: Product) => {
    addToCart(product);
    messageApi.success(`${product.name} đã được thêm vào giỏ hàng`);
  };

  const handleCheckout = () => {
    setIsCartOpen(false);
    router.push("/checkout");
  };

  const handleViewDetail = (product: Product) => {
    router.push(`/products/${product.id}`);
  };

  const carouselItems = [
    { image: "/banners/banner-1.svg", alt: "Ưu đãi gia dụng" },
    { image: "/banners/banner-2.svg", alt: "Mua sắm nhanh chóng" },
    { image: "/banners/banner-3.svg", alt: "Chính hãng giá tốt" },
    { image: "/banners/banner-1.svg", alt: "Ưu đãi gia dụng" },
    { image: "/banners/banner-2.svg", alt: "Mua sắm nhanh chóng" },
    { image: "/banners/banner-3.svg", alt: "Chính hãng giá tốt" },
  ];

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
                  }}
                >
                  <img
                    src={item.image}
                    alt={item.alt}
                    style={{ width: "100%", height: "auto", display: "block" }}
                  />
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
