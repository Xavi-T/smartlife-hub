"use client";

import { useState, useEffect } from "react";
import {
  X,
  Package,
  DollarSign,
  Truck,
  FileText,
  Calculator,
} from "lucide-react";
import { formatCurrency } from "@/lib/utils";
import { toast } from "sonner";
import type { Product } from "@/types/database";

interface StockInboundModalProps {
  isOpen: boolean;
  onClose: () => void;
  product?: Product | null;
  onSuccess?: () => void;
}

export function StockInboundModal({
  isOpen,
  onClose,
  product: initialProduct,
  onSuccess,
}: StockInboundModalProps) {
  const [products, setProducts] = useState<Product[]>([]);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(
    initialProduct || null,
  );
  const [quantityAdded, setQuantityAdded] = useState("");
  const [costPriceAtTime, setCostPriceAtTime] = useState("");
  const [supplier, setSupplier] = useState("");
  const [notes, setNotes] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (isOpen && !initialProduct) {
      fetchProducts();
    }
  }, [isOpen, initialProduct]);

  useEffect(() => {
    if (initialProduct) {
      setSelectedProduct(initialProduct);
    }
  }, [initialProduct]);

  const fetchProducts = async () => {
    try {
      const res = await fetch("/api/products");
      if (res.ok) {
        const data = await res.json();
        setProducts(data);
      }
    } catch (error) {
      console.error("Error fetching products:", error);
    }
  };

  if (!isOpen) return null;

  const product = selectedProduct;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!product) {
      toast.error("Vui lòng chọn sản phẩm");
      return;
    }

    const qty = parseInt(quantityAdded);
    const cost = parseFloat(costPriceAtTime);

    if (qty <= 0) {
      toast.warning("Số lượng nhập phải lớn hơn 0");
      return;
    }

    if (cost < 0) {
      toast.warning("Giá vốn không được âm");
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await fetch("/api/admin/stock-inbound", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          productId: product.id,
          quantityAdded: qty,
          costPriceAtTime: cost,
          supplier: supplier.trim() || null,
          notes: notes.trim() || null,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Không thể nhập hàng");
      }

      toast.success(
        `Đã nhập ${qty} ${product?.name}. Tồn kho mới: ${result.data.new_stock_quantity}`,
        {
          description: `Giá vốn BQ mới: ${formatCurrency(result.data.new_weighted_avg_cost)}`,
        },
      );

      // Reset form
      setQuantityAdded("");
      setCostPriceAtTime("");
      setSupplier("");
      setNotes("");
      setSelectedProduct(null);

      if (onSuccess) onSuccess();
      onClose();
    } catch (error: any) {
      toast.error(error.message || "Đã xảy ra lỗi khi nhập hàng");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    if (!isSubmitting) {
      setQuantityAdded("");
      setCostPriceAtTime("");
      setSupplier("");
      setNotes("");
      setSelectedProduct(null);
      onClose();
    }
  };

  // Tính preview giá vốn bình quân
  const calculatePreviewAvgCost = () => {
    if (!product) return null;

    const qty = parseInt(quantityAdded);
    const cost = parseFloat(costPriceAtTime);

    if (!qty || !cost || qty <= 0 || cost < 0) return null;

    const currentQty = product.stock_quantity || 0;
    const currentCost = product.cost_price || 0;

    if (currentQty === 0) return cost;

    const newAvgCost =
      (currentQty * currentCost + qty * cost) / (currentQty + qty);

    return newAvgCost;
  };

  const previewAvgCost = calculatePreviewAvgCost();
  const totalValue =
    parseInt(quantityAdded || "0") * parseFloat(costPriceAtTime || "0");

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black bg-opacity-50 transition-opacity"
        onClick={handleClose}
      />

      {/* Modal */}
      <div className="relative min-h-screen flex items-center justify-center p-4">
        <div className="relative bg-white rounded-xl shadow-2xl max-w-2xl w-full">
          {/* Header */}
          <div className="bg-gradient-to-r from-blue-600 to-purple-600 px-6 py-4 rounded-t-xl">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-white/20 rounded-lg backdrop-blur">
                  <Package className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-white">
                    Nhập hàng vào kho
                  </h2>
                  <p className="text-sm text-blue-100">Ghi nhận lô hàng mới</p>
                </div>
              </div>
              <button
                onClick={handleClose}
                disabled={isSubmitting}
                className="p-2 hover:bg-white/20 rounded-lg transition-colors"
              >
                <X className="w-5 h-5 text-white" />
              </button>
            </div>
          </div>

          {/* Product Info or Selection */}
          {product ? (
            <div className="px-6 py-4 bg-gray-50 border-b border-gray-200">
              <div className="flex items-center gap-4">
                {product.image_url ? (
                  <img
                    src={product.image_url}
                    alt={product.name}
                    className="w-16 h-16 object-cover rounded-lg shadow-sm"
                  />
                ) : (
                  <div className="w-16 h-16 bg-gray-200 rounded-lg flex items-center justify-center">
                    📦
                  </div>
                )}
                <div className="flex-1">
                  <h3 className="font-semibold text-gray-900">
                    {product.name}
                  </h3>
                  <div className="flex items-center gap-4 text-sm text-gray-600 mt-1">
                    <span>
                      Tồn kho: <strong>{product.stock_quantity}</strong>
                    </span>
                    <span>
                      Giá vốn:{" "}
                      <strong>{formatCurrency(product.cost_price)}</strong>
                    </span>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="px-6 py-4 bg-gray-50 border-b border-gray-200">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Chọn sản phẩm <span className="text-red-500">*</span>
              </label>
              <select
                value={selectedProduct?.id || ""}
                onChange={(e) => {
                  const product = products.find((p) => p.id === e.target.value);
                  setSelectedProduct(product || null);
                  setCostPriceAtTime(product?.cost_price?.toString() || "");
                }}
                required
                className="w-full px-4 py-2 border-2 border-gray-400 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900 font-medium"
              >
                <option value="">-- Chọn sản phẩm --</option>
                {products.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} (Tồn: {p.stock_quantity})
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="p-6 space-y-5">
            {/* Quantity & Cost Price */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  <Package className="w-4 h-4 inline mr-1" />
                  Số lượng nhập <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  value={quantityAdded}
                  onChange={(e) => setQuantityAdded(e.target.value)}
                  min="1"
                  required
                  className="w-full px-4 py-2 border-2 border-gray-400 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900 placeholder:text-gray-600 font-medium"
                  placeholder="Nhập số lượng"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  <DollarSign className="w-4 h-4 inline mr-1" />
                  Giá vốn/sản phẩm <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  value={costPriceAtTime}
                  onChange={(e) => setCostPriceAtTime(e.target.value)}
                  min="0"
                  step="0.01"
                  required
                  className="w-full px-4 py-2 border-2 border-gray-400 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900 placeholder:text-gray-600 font-medium"
                  placeholder="Nhập giá vốn"
                />
              </div>
            </div>

            {/* Supplier */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                <Truck className="w-4 h-4 inline mr-1" />
                Nhà cung cấp
              </label>
              <input
                type="text"
                value={supplier}
                onChange={(e) => setSupplier(e.target.value)}
                className="w-full px-4 py-2 border-2 border-gray-400 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900 placeholder:text-gray-600 font-medium"
                placeholder="Tên nhà cung cấp (không bắt buộc)"
              />
            </div>

            {/* Notes */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                <FileText className="w-4 h-4 inline mr-1" />
                Ghi chú
              </label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={3}
                className="w-full px-4 py-2 border-2 border-gray-400 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900 placeholder:text-gray-600 font-medium"
                placeholder="Ghi chú về lô hàng (không bắt buộc)"
              />
            </div>

            {/* Preview Calculation */}
            {previewAvgCost !== null && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <div className="flex items-start gap-3">
                  <Calculator className="w-5 h-5 text-blue-600 mt-0.5" />
                  <div className="flex-1">
                    <h4 className="text-sm font-semibold text-blue-900 mb-2">
                      Dự tính sau khi nhập
                    </h4>
                    <div className="grid grid-cols-3 gap-3 text-sm">
                      <div>
                        <p className="text-blue-600 mb-1">Tồn kho mới</p>
                        <p className="font-bold text-blue-900">
                          {(product.stock_quantity || 0) +
                            parseInt(quantityAdded || "0")}
                        </p>
                      </div>
                      <div>
                        <p className="text-blue-600 mb-1">Giá vốn BQ mới</p>
                        <p className="font-bold text-blue-900">
                          {formatCurrency(previewAvgCost)}
                        </p>
                      </div>
                      <div>
                        <p className="text-blue-600 mb-1">Tổng giá trị nhập</p>
                        <p className="font-bold text-blue-900">
                          {formatCurrency(totalValue)}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Actions */}
            <div className="flex items-center justify-end gap-3 pt-4 border-t border-gray-200">
              <button
                type="button"
                onClick={handleClose}
                disabled={isSubmitting}
                className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg transition-colors disabled:opacity-50"
              >
                Hủy
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors disabled:opacity-50 flex items-center gap-2"
              >
                {isSubmitting ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Đang xử lý...
                  </>
                ) : (
                  <>
                    <Package className="w-4 h-4" />
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
