"use client";

import { AlertTriangle, Package } from "lucide-react";
import { formatCurrency } from "@/lib/utils";
import type { Product } from "@/types/database";

interface InventoryTableProps {
  products: Product[];
  onProductClick: (product: Product) => void;
}

export function InventoryTable({
  products,
  onProductClick,
}: InventoryTableProps) {
  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-100 overflow-hidden">
      <div className="px-6 py-4 border-b border-gray-200">
        <h2 className="text-lg font-semibold text-gray-900">
          Danh sách sản phẩm ({products.length})
        </h2>
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Sản phẩm
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Danh mục
              </th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                Giá vốn
              </th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                Giá bán
              </th>
              <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                Tồn kho
              </th>
              <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                Hành động
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {products.map((product) => {
              const isLowStock = product.stock_quantity < 10;
              const profit = product.price - product.cost_price;
              const profitMargin = ((profit / product.price) * 100).toFixed(1);

              return (
                <tr
                  key={product.id}
                  className={`hover:bg-gray-50 transition-colors cursor-pointer ${
                    isLowStock ? "bg-red-50" : ""
                  }`}
                  onClick={() => onProductClick(product)}
                >
                  {/* Product */}
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-4">
                      {product.image_url ? (
                        <img
                          src={product.image_url}
                          alt={product.name}
                          className="h-12 w-12 rounded-lg object-cover"
                        />
                      ) : (
                        <div className="h-12 w-12 rounded-lg bg-gray-200 flex items-center justify-center">
                          <span className="text-gray-400 text-xs">N/A</span>
                        </div>
                      )}
                      <div>
                        <div className="font-medium text-gray-900">
                          {product.name}
                        </div>
                        {product.description && (
                          <div className="text-sm text-gray-500 line-clamp-1 max-w-xs">
                            {product.description}
                          </div>
                        )}
                      </div>
                    </div>
                  </td>

                  {/* Category */}
                  <td className="px-6 py-4">
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                      {product.category}
                    </span>
                  </td>

                  {/* Cost Price */}
                  <td className="px-6 py-4 text-right">
                    <div className="text-sm font-medium text-gray-900">
                      {formatCurrency(product.cost_price)}
                    </div>
                  </td>

                  {/* Selling Price */}
                  <td className="px-6 py-4 text-right">
                    <div className="text-sm font-bold text-blue-600">
                      {formatCurrency(product.price)}
                    </div>
                    <div className="text-xs text-gray-500">
                      Lãi: {profitMargin}%
                    </div>
                  </td>

                  {/* Stock */}
                  <td className="px-6 py-4">
                    <div className="flex flex-col items-center gap-1">
                      <span
                        className={`text-lg font-bold ${
                          isLowStock ? "text-red-600" : "text-gray-900"
                        }`}
                      >
                        {product.stock_quantity}
                      </span>
                      {isLowStock && (
                        <div className="flex items-center gap-1">
                          <AlertTriangle className="w-3 h-3 text-red-500" />
                          <span className="text-xs font-semibold text-red-600 bg-red-100 px-2 py-0.5 rounded-full">
                            Cần nhập hàng
                          </span>
                        </div>
                      )}
                    </div>
                  </td>

                  {/* Action */}
                  <td className="px-6 py-4 text-center">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onProductClick(product);
                      }}
                      className="inline-flex items-center gap-2 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors"
                    >
                      <Package className="w-4 h-4" />
                      Nhập hàng
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {products.length === 0 && (
        <div className="text-center py-12 text-gray-500">
          Không tìm thấy sản phẩm nào
        </div>
      )}
    </div>
  );
}
