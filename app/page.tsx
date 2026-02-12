'use client';

import { useEffect, useState } from 'react';
import { Header } from '@/components/home/Header';
import { ProductGrid } from '@/components/home/ProductGrid';
import { CartModal } from '@/components/home/CartModal';
import { CheckoutModal } from '@/components/home/CheckoutModal';
import { useCart } from '@/hooks/useCart';
import type { Product } from '@/types/database';

export default function Home() {
  const [products, setProducts] = useState<Product[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [isCheckoutOpen, setIsCheckoutOpen] = useState(false);
  
  const {
    cart,
    addToCart,
    updateQuantity,
    removeFromCart,
    clearCart,
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
      const res = await fetch('/api/products');
      if (!res.ok) throw new Error('Failed to fetch products');
      const data = await res.json();
      // Chỉ hiển thị sản phẩm đang hoạt động
      setProducts(data.filter((p: Product) => p.is_active));
    } catch (error) {
      console.error('Error fetching products:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddToCart = (product: Product) => {
    addToCart(product);
    // Optional: Show toast notification
  };

  const handleCheckout = () => {
    setIsCartOpen(false);
    setIsCheckoutOpen(true);
  };

  const handleOrderSuccess = () => {
    clearCart();
    fetchProducts(); // Refresh products to update stock
  };

  if (isLoading || !isLoaded) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-gray-600">Đang tải sản phẩm...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <Header
        cartItemsCount={getTotalItems()}
        onCartClick={() => setIsCartOpen(true)}
      />

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Hero Section */}
        <div className="mb-8">
          <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-2">
            Sản phẩm gia dụng chất lượng
          </h2>
          <p className="text-gray-600">
            Khám phá bộ sưu tập đồ gia dụng tiện ích cho ngôi nhà của bạn
          </p>
        </div>

        {/* Product Grid */}
        <ProductGrid products={products} onAddToCart={handleAddToCart} />

        {/* Empty State */}
        {products.length === 0 && (
          <div className="text-center py-16">
            <p className="text-gray-500 text-lg mb-4">Chưa có sản phẩm nào</p>
            <button
              onClick={fetchProducts}
              className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg transition-colors"
            >
              Tải lại
            </button>
          </div>
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

      {/* Checkout Modal */}
      <CheckoutModal
        isOpen={isCheckoutOpen}
        onClose={() => setIsCheckoutOpen(false)}
        cart={cart}
        totalPrice={getTotalPrice()}
        onSuccess={handleOrderSuccess}
      />
    </div>
  );
}
