"use client";

import { useState } from "react";
import { X, Package, Loader2 } from "lucide-react";
import { formatCurrency } from "@/lib/utils";
import { toast } from "sonner";
import type { Product } from "@/types/database";

interface RestockModalProps {
  isOpen: boolean;
  onClose: () => void;
  product: Product | null;
  onSuccess: () => void;
}

export function RestockModal({
  isOpen,
  onClose,
  product,
  onSuccess,
}: RestockModalProps) {
  const [quantity, setQuantity] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");

  if (!isOpen || !product) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    const quantityToAdd = parseInt(quantity);
    if (isNaN(quantityToAdd) || quantityToAdd <= 0) {
      setError("Vui lòng nhập số lượng hợp lệ");
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await fetch("/api/admin/inventory/restock", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          productId: product.id,
          quantityToAdd,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Không thể nhập hàng");
      }

      toast.success(`Đã thêm ${quantityToAdd} sản phẩm vào kho`);
      onSuccess();
      setQuantity("");
      onClose();
    } catch (err: any) {
      setError(err.message || "Đã xảy ra lỗi");
      toast.error(err.message || "Đã xảy ra lỗi khi nhập hàng");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    setQuantity("");
    setError("");
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black bg-opacity-50"
        onClick={handleClose}
      />

      {/* Modal */}
      <div className="relative bg-white rounded-lg shadow-xl max-w-md w-full">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 rounded-lg">
              <Package className="w-5 h-5 text-blue-600" />
            </div>
            <h2 className="text-xl font-bold text-gray-900">Nhập hàng nhanh</h2>
          </div>
          <button
            onClick={handleClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6">
          {/* Product Info */}
          <div className="flex gap-4 mb-6 p-4 bg-gray-50 rounded-lg">
            {product.image_url ? (
              <img
                src={product.image_url}
                alt={product.name}
                className="w-20 h-20 object-cover rounded-lg"
              />
            ) : (
              <div className="w-20 h-20 bg-gray-200 rounded-lg flex items-center justify-center">
                <span className="text-3xl">📦</span>
              </div>
            )}
            <div className="flex-1">
              <h3 className="font-semibold text-gray-900 mb-1">
                {product.name}
              </h3>
              <p className="text-sm text-gray-600 mb-2">{product.category}</p>
              <div className="flex items-center gap-3 text-sm">
                <span className="text-gray-600">
                  Tồn kho:{" "}
                  <span className="font-semibold text-gray-900">
                    {product.stock_quantity}
                  </span>
                </span>
                <span className="text-gray-400">•</span>
                <span className="text-gray-600">
                  Giá vốn:{" "}
                  <span className="font-semibold text-blue-600">
                    {formatCurrency(product.cost_price)}
                  </span>
                </span>
              </div>
            </div>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Số lượng nhập thêm <span className="text-red-500">*</span>
              </label>
              <input
                type="number"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Nhập số lượng..."
                min="1"
                required
                autoFocus
              />
              <p className="mt-2 text-sm text-gray-500">
                Số lượng mới sau khi nhập:{" "}
                <span className="font-semibold text-blue-600">
                  {product.stock_quantity + (parseInt(quantity) || 0)}
                </span>
              </p>
            </div>

            {error && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-800">
                {error}
              </div>
            )}

            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={handleClose}
                className="flex-1 px-4 py-3 border border-gray-300 rounded-lg font-medium text-gray-700 hover:bg-gray-50 transition-colors"
              >
                Hủy
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="flex-1 px-4 py-3 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    Đang xử lý...
                  </>
                ) : (
                  <>
                    <Package className="w-5 h-5" />
                    Xác nhận nhập hàng
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
