"use client";

import { useState } from "react";
import { PackagePlus, Loader2 } from "lucide-react";
import type { Product } from "@/types/database";

interface QuickStockFormProps {
  products: Product[];
  onStockUpdated: () => void;
}

export function QuickStockForm({
  products,
  onStockUpdated,
}: QuickStockFormProps) {
  const [selectedProductId, setSelectedProductId] = useState("");
  const [quantity, setQuantity] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!selectedProductId || !quantity) {
      setMessage({
        type: "error",
        text: "Vui lòng chọn sản phẩm và nhập số lượng",
      });
      return;
    }

    const quantityNum = parseInt(quantity);
    if (quantityNum <= 0) {
      setMessage({ type: "error", text: "Số lượng phải lớn hơn 0" });
      return;
    }

    setIsSubmitting(true);
    setMessage(null);

    try {
      const response = await fetch("/api/products/stock", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          productId: selectedProductId,
          quantity: quantityNum,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to update stock");
      }

      const selectedProduct = products.find((p) => p.id === selectedProductId);
      setMessage({
        type: "success",
        text: `Đã nhập thêm ${quantityNum} ${selectedProduct?.name || "sản phẩm"} vào kho!`,
      });

      // Reset form
      setSelectedProductId("");
      setQuantity("");

      // Refresh data
      onStockUpdated();

      // Clear message after 3 seconds
      setTimeout(() => setMessage(null), 3000);
    } catch (error) {
      console.error("Error updating stock:", error);
      setMessage({ type: "error", text: "Có lỗi xảy ra khi cập nhật kho" });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="bg-white rounded-lg shadow-md p-6 border border-gray-100">
      <div className="flex items-center gap-2 mb-4">
        <PackagePlus className="w-5 h-5 text-blue-600" />
        <h2 className="text-lg font-semibold text-gray-900">Nhập hàng nhanh</h2>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label
            htmlFor="product"
            className="block text-sm font-medium text-gray-700 mb-1"
          >
            Chọn sản phẩm
          </label>
          <select
            id="product"
            value={selectedProductId}
            onChange={(e) => setSelectedProductId(e.target.value)}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            disabled={isSubmitting}
          >
            <option value="">-- Chọn sản phẩm --</option>
            {products
              .filter((p) => p.is_active)
              .map((product) => (
                <option key={product.id} value={product.id}>
                  {product.name} (Tồn: {product.stock_quantity})
                </option>
              ))}
          </select>
        </div>

        <div>
          <label
            htmlFor="quantity"
            className="block text-sm font-medium text-gray-700 mb-1"
          >
            Số lượng nhập thêm
          </label>
          <input
            type="number"
            id="quantity"
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
            min="1"
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            placeholder="Nhập số lượng..."
            disabled={isSubmitting}
          />
        </div>

        {message && (
          <div
            className={`p-3 rounded-lg text-sm ${
              message.type === "success"
                ? "bg-green-50 text-green-800 border border-green-200"
                : "bg-red-50 text-red-800 border border-red-200"
            }`}
          >
            {message.text}
          </div>
        )}

        <button
          type="submit"
          disabled={isSubmitting}
          className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
        >
          {isSubmitting ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Đang xử lý...
            </>
          ) : (
            <>
              <PackagePlus className="w-4 h-4" />
              Nhập hàng
            </>
          )}
        </button>
      </form>
    </div>
  );
}
