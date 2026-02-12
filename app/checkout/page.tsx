"use client";

import { useState, useEffect } from "react";
import { ShoppingCart, Trash2, Plus, Minus, CheckCircle } from "lucide-react";
import { createOrder, checkStockAvailability } from "@/actions/orders";
import { formatCurrency } from "@/lib/utils";
import type { Product } from "@/types/database";
import type { CartItem, CustomerInfo } from "@/types/order";

interface CartItemWithProduct extends CartItem {
  product?: Product;
}

export default function CheckoutPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [cart, setCart] = useState<CartItemWithProduct[]>([]);
  const [customer, setCustomer] = useState<CustomerInfo>({
    name: "",
    phone: "",
    address: "",
    notes: "",
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);
  const [orderId, setOrderId] = useState<string | null>(null);

  // Load products
  useEffect(() => {
    fetchProducts();
  }, []);

  const fetchProducts = async () => {
    try {
      const res = await fetch("/api/products");
      const data = await res.json();
      setProducts(
        data.filter((p: Product) => p.is_active && p.stock_quantity > 0),
      );
    } catch (error) {
      console.error("Error fetching products:", error);
    }
  };

  // Add to cart
  const addToCart = (product: Product) => {
    setCart((prev) => {
      const existing = prev.find((item) => item.product_id === product.id);
      if (existing) {
        return prev.map((item) =>
          item.product_id === product.id
            ? { ...item, quantity: item.quantity + 1 }
            : item,
        );
      }
      return [...prev, { product_id: product.id, quantity: 1, product }];
    });
  };

  // Update quantity
  const updateQuantity = (productId: string, delta: number) => {
    setCart((prev) =>
      prev
        .map((item) =>
          item.product_id === productId
            ? { ...item, quantity: Math.max(0, item.quantity + delta) }
            : item,
        )
        .filter((item) => item.quantity > 0),
    );
  };

  // Remove from cart
  const removeFromCart = (productId: string) => {
    setCart((prev) => prev.filter((item) => item.product_id !== productId));
  };

  // Calculate total
  const calculateTotal = () => {
    return cart.reduce((sum, item) => {
      const product = products.find((p) => p.id === item.product_id);
      return sum + (product?.price || 0) * item.quantity;
    }, 0);
  };

  // Handle submit
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage(null);
    setIsSubmitting(true);

    try {
      // Check stock first
      const stockCheck = await checkStockAvailability(cart);
      if (!stockCheck.available) {
        setMessage({
          type: "error",
          text: stockCheck.message || "Kiểm tra tồn kho thất bại",
        });
        setIsSubmitting(false);
        return;
      }

      // Create order
      const result = await createOrder({
        customer,
        items: cart,
      });

      if (result.success) {
        setMessage({ type: "success", text: result.message });
        setOrderId(result.orderId || null);
        setCart([]);
        setCustomer({ name: "", phone: "", address: "", notes: "" });
      } else {
        setMessage({ type: "error", text: result.message });
      }
    } catch (error) {
      console.error("Error:", error);
      setMessage({ type: "error", text: "Đã xảy ra lỗi không mong muốn" });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-8">Đặt hàng</h1>

        {orderId && message?.type === "success" && (
          <div className="mb-6 bg-green-50 border border-green-200 rounded-lg p-6">
            <div className="flex items-start gap-3">
              <CheckCircle className="w-6 h-6 text-green-600 mt-0.5" />
              <div className="flex-1">
                <h3 className="text-lg font-semibold text-green-900 mb-2">
                  Đặt hàng thành công! 🎉
                </h3>
                <p className="text-green-700 mb-2">{message.text}</p>
                <p className="text-sm text-green-600">
                  Mã đơn hàng:{" "}
                  <span className="font-mono font-semibold">{orderId}</span>
                </p>
              </div>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Product List */}
          <div className="lg:col-span-2">
            <div className="bg-white rounded-lg shadow-md p-6 mb-6">
              <h2 className="text-xl font-semibold mb-4">Danh sách sản phẩm</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {products.map((product) => (
                  <div
                    key={product.id}
                    className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow"
                  >
                    {product.image_url && (
                      <img
                        src={product.image_url}
                        alt={product.name}
                        className="w-full h-40 object-cover rounded-md mb-3"
                      />
                    )}
                    <h3 className="font-semibold text-gray-900 mb-1">
                      {product.name}
                    </h3>
                    <p className="text-sm text-gray-600 mb-2">
                      {product.category}
                    </p>
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-lg font-bold text-blue-600">
                          {formatCurrency(product.price)}
                        </p>
                        <p className="text-xs text-gray-500">
                          Còn: {product.stock_quantity}
                        </p>
                      </div>
                      <button
                        onClick={() => addToCart(product)}
                        className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm transition-colors"
                      >
                        Thêm
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Cart & Checkout */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-lg shadow-md p-6 sticky top-8">
              <div className="flex items-center gap-2 mb-4">
                <ShoppingCart className="w-5 h-5 text-blue-600" />
                <h2 className="text-xl font-semibold">
                  Giỏ hàng ({cart.length})
                </h2>
              </div>

              {cart.length === 0 ? (
                <p className="text-gray-500 text-center py-8">Giỏ hàng trống</p>
              ) : (
                <>
                  <div className="space-y-3 mb-4 max-h-60 overflow-y-auto">
                    {cart.map((item) => {
                      const product = products.find(
                        (p) => p.id === item.product_id,
                      );
                      if (!product) return null;

                      return (
                        <div
                          key={item.product_id}
                          className="flex items-center gap-3 border-b pb-3"
                        >
                          <div className="flex-1">
                            <p className="font-medium text-sm">
                              {product.name}
                            </p>
                            <p className="text-sm text-gray-600">
                              {formatCurrency(product.price)} × {item.quantity}
                            </p>
                          </div>
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() =>
                                updateQuantity(item.product_id, -1)
                              }
                              className="p-1 hover:bg-gray-100 rounded"
                            >
                              <Minus className="w-4 h-4" />
                            </button>
                            <span className="w-8 text-center font-semibold">
                              {item.quantity}
                            </span>
                            <button
                              onClick={() => updateQuantity(item.product_id, 1)}
                              className="p-1 hover:bg-gray-100 rounded"
                            >
                              <Plus className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => removeFromCart(item.product_id)}
                              className="p-1 hover:bg-red-100 text-red-600 rounded"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  <div className="border-t pt-4 mb-4">
                    <div className="flex justify-between items-center text-lg font-bold">
                      <span>Tổng cộng:</span>
                      <span className="text-blue-600">
                        {formatCurrency(calculateTotal())}
                      </span>
                    </div>
                  </div>

                  <form onSubmit={handleSubmit} className="space-y-3">
                    <div>
                      <input
                        type="text"
                        placeholder="Họ tên *"
                        value={customer.name}
                        onChange={(e) =>
                          setCustomer({ ...customer, name: e.target.value })
                        }
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
                        required
                      />
                    </div>
                    <div>
                      <input
                        type="tel"
                        placeholder="Số điện thoại *"
                        value={customer.phone}
                        onChange={(e) =>
                          setCustomer({ ...customer, phone: e.target.value })
                        }
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
                        required
                      />
                    </div>
                    <div>
                      <textarea
                        placeholder="Địa chỉ giao hàng *"
                        value={customer.address}
                        onChange={(e) =>
                          setCustomer({ ...customer, address: e.target.value })
                        }
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
                        rows={3}
                        required
                      />
                    </div>
                    <div>
                      <textarea
                        placeholder="Ghi chú (tùy chọn)"
                        value={customer.notes}
                        onChange={(e) =>
                          setCustomer({ ...customer, notes: e.target.value })
                        }
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
                        rows={2}
                      />
                    </div>

                    {message && message.type === "error" && (
                      <div className="bg-red-50 border border-red-200 text-red-800 px-3 py-2 rounded-lg text-sm">
                        {message.text}
                      </div>
                    )}

                    <button
                      type="submit"
                      disabled={isSubmitting}
                      className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {isSubmitting ? "Đang xử lý..." : "Đặt hàng"}
                    </button>
                  </form>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
