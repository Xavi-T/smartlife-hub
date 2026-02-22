"use client";

import { useEffect, useState } from "react";
import { Header } from "@/components/home/Header";
import { ProductGrid } from "@/components/home/ProductGrid";
import { CartModal } from "@/components/home/CartModal";
import { useCart } from "@/hooks/useCart";
import type { Product } from "@/types/database";
import { Button, Card, Empty, Space, Spin, Typography, message } from "antd";
import { useRouter } from "next/navigation";

export default function Home() {
  const router = useRouter();
  const [messageApi, contextHolder] = message.useMessage();
  const [products, setProducts] = useState<Product[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isCartOpen, setIsCartOpen] = useState(false);

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
        {/* Hero Section */}
        <Card style={{ marginBottom: 24 }}>
          <Typography.Title level={2} style={{ marginBottom: 8 }}>
            Sản phẩm gia dụng chất lượng
          </Typography.Title>
          <Typography.Text type="secondary">
            Khám phá bộ sưu tập đồ gia dụng tiện ích cho ngôi nhà của bạn
          </Typography.Text>
        </Card>

        {/* Product Grid */}
        <ProductGrid
          products={products}
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
