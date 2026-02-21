"use client";

import { ShoppingCart } from "lucide-react";
import { calculateDiscountedPrice, formatCurrency } from "@/lib/utils";
import type { Product } from "@/types/database";

interface ProductCardProps {
  product: Product;
  onAddToCart: (product: Product) => void;
  onViewDetail: (product: Product) => void;
}

export function ProductCard({
  product,
  onAddToCart,
  onViewDetail,
}: ProductCardProps) {
  const isOutOfStock = product.stock_quantity === 0;
  const discountPercent = product.discount_percent || 0;
  const hasDiscount = discountPercent > 0;
  const finalPrice = calculateDiscountedPrice(product.price, discountPercent);
  const savingAmount = product.price - finalPrice;

  return (
    <div
      className={`bg-white rounded-lg shadow-md overflow-hidden transition-shadow duration-300 ${
        isOutOfStock ? "cursor-pointer" : "cursor-pointer hover:shadow-xl"
      }`}
      onClick={() => onViewDetail(product)}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onViewDetail(product);
        }
      }}
      role="button"
      tabIndex={0}
      title="Xem chi tiết sản phẩm"
    >
      {/* Image */}
      <div className="relative aspect-square bg-gray-100">
        {product.image_url ? (
          <img
            src={product.image_url}
            alt={product.name}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-gray-400">
            <span className="text-4xl">📦</span>
          </div>
        )}

        {product.stock_quantity < 5 && product.stock_quantity > 0 && (
          <div className="absolute top-2 right-2 bg-orange-500 text-white text-xs font-semibold px-2 py-1 rounded">
            Còn {product.stock_quantity}
          </div>
        )}

        {hasDiscount && (
          <div className="absolute top-2 left-2 bg-red-500 text-white text-sm font-bold px-2.5 py-1 rounded-full shadow">
            -{discountPercent}%
          </div>
        )}

        {isOutOfStock && (
          <div className="absolute inset-0 bg-black bg-opacity-50 flex items-center justify-center">
            <span className="bg-red-600 text-white font-bold px-4 py-2 rounded-lg">
              Hết hàng
            </span>
          </div>
        )}
      </div>

      {/* Content */}
      <div className="p-4">
        <div className="mb-2">
          <span className="inline-block bg-blue-100 text-blue-800 text-xs font-medium px-2 py-1 rounded">
            {product.category}
          </span>
        </div>

        <h3 className="font-semibold text-gray-900 mb-2 line-clamp-2 min-h-12">
          {product.name}
        </h3>

        {product.description && (
          <p className="text-sm text-gray-600 mb-3 line-clamp-2">
            {product.description}
          </p>
        )}

        <div className="flex items-end justify-between mt-auto">
          <div>
            <p className="text-3xl font-extrabold text-red-600 leading-none">
              {formatCurrency(finalPrice)}
            </p>
            {hasDiscount && (
              <div className="mt-1 space-y-0.5">
                <p className="text-sm text-gray-500 line-through leading-none">
                  {formatCurrency(product.price)}
                </p>
                <p className="text-xs font-semibold text-red-500 leading-none">
                  Tiết kiệm {formatCurrency(savingAmount)}
                </p>
              </div>
            )}
          </div>

          <button
            onClick={(event) => {
              event.stopPropagation();
              onAddToCart(product);
            }}
            disabled={isOutOfStock}
            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-medium px-4 py-2 rounded-lg transition-colors disabled:bg-gray-300 disabled:cursor-not-allowed"
          >
            <ShoppingCart className="w-4 h-4" />
            <span className="hidden sm:inline">Thêm</span>
          </button>
        </div>
      </div>
    </div>
  );
}
