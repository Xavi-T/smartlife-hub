"use client";

import { useState, useEffect } from "react";
import { TrendingUp, Award, DollarSign, Package, Loader2 } from "lucide-react";
import { formatCurrency } from "@/lib/utils";

interface TopProduct {
  product_id: string;
  name: string;
  image_url: string | null;
  category: string;
  total_quantity: number;
  total_revenue: number;
  total_profit: number;
  rank: number;
  percentage: number;
}

export function TopSellingProducts() {
  const [products, setProducts] = useState<TopProduct[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchTopProducts();
  }, []);

  const fetchTopProducts = async () => {
    try {
      const res = await fetch("/api/admin/top-products");
      if (!res.ok) throw new Error("Failed to fetch");
      const data = await res.json();
      setProducts(data);
    } catch (error) {
      console.error("Error fetching top products:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const getRankColor = (rank: number) => {
    switch (rank) {
      case 1:
        return "bg-gradient-to-br from-yellow-400 to-yellow-600 text-white";
      case 2:
        return "bg-gradient-to-br from-gray-300 to-gray-500 text-white";
      case 3:
        return "bg-gradient-to-br from-orange-400 to-orange-600 text-white";
      default:
        return "bg-gray-200 text-gray-700";
    }
  };

  const getRankIcon = (rank: number) => {
    if (rank <= 3) {
      return <Award className="w-4 h-4" />;
    }
    return <span className="font-bold">#{rank}</span>;
  };

  if (isLoading) {
    return (
      <div className="bg-white rounded-lg shadow-sm border border-gray-100 p-6">
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-6 h-6 text-blue-600 animate-spin" />
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-100">
      {/* Header */}
      <div className="px-6 py-4 border-b border-gray-200">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg">
            <TrendingUp className="w-5 h-5 text-white" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-gray-900">
              Top 5 Sản phẩm bán chạy
            </h2>
            <p className="text-xs text-gray-500">Dựa trên đơn đã giao</p>
          </div>
        </div>
      </div>

      {/* Products List */}
      <div className="p-6">
        {products.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            Chưa có dữ liệu bán hàng
          </div>
        ) : (
          <div className="space-y-5">
            {products.map((product) => (
              <div
                key={product.product_id}
                className="group hover:bg-gray-50 p-4 rounded-xl transition-all duration-200 border border-transparent hover:border-gray-200"
              >
                {/* Product Info */}
                <div className="flex items-start gap-4 mb-3">
                  {/* Rank Badge */}
                  <div
                    className={`flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center shadow-sm ${getRankColor(
                      product.rank,
                    )}`}
                  >
                    {getRankIcon(product.rank)}
                  </div>

                  {/* Product Image */}
                  <div className="flex-shrink-0">
                    {product.image_url ? (
                      <img
                        src={product.image_url}
                        alt={product.name}
                        className="w-16 h-16 object-cover rounded-lg shadow-sm"
                      />
                    ) : (
                      <div className="w-16 h-16 bg-gray-200 rounded-lg flex items-center justify-center shadow-sm">
                        <Package className="w-6 h-6 text-gray-400" />
                      </div>
                    )}
                  </div>

                  {/* Product Details */}
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-gray-900 truncate mb-1">
                      {product.name}
                    </h3>
                    <div className="flex items-center gap-2 text-xs text-gray-500 mb-2">
                      <span className="px-2 py-0.5 bg-blue-50 text-blue-700 rounded-full">
                        {product.category}
                      </span>
                    </div>

                    {/* Stats Grid */}
                    <div className="grid grid-cols-3 gap-3 text-sm">
                      <div>
                        <p className="text-gray-500 text-xs mb-0.5">Đã bán</p>
                        <p className="font-bold text-gray-900 flex items-center gap-1">
                          <Package className="w-3.5 h-3.5 text-blue-600" />
                          {product.total_quantity}
                        </p>
                      </div>
                      <div>
                        <p className="text-gray-500 text-xs mb-0.5">
                          Doanh thu
                        </p>
                        <p className="font-bold text-green-600 text-xs">
                          {formatCurrency(product.total_revenue)}
                        </p>
                      </div>
                      <div>
                        <p className="text-gray-500 text-xs mb-0.5">
                          Lợi nhuận
                        </p>
                        <p className="font-bold text-purple-600 flex items-center gap-1 text-xs">
                          <DollarSign className="w-3.5 h-3.5" />
                          {formatCurrency(product.total_profit)}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Progress Bar */}
                <div className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-gray-600">Tỷ trọng doanh số</span>
                    <span className="font-semibold text-gray-900">
                      {product.percentage.toFixed(1)}%
                    </span>
                  </div>
                  <div className="relative h-2 bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className="absolute top-0 left-0 h-full bg-gradient-to-r from-blue-500 to-purple-600 rounded-full transition-all duration-500"
                      style={{ width: `${product.percentage}%` }}
                    />
                  </div>
                </div>

                {/* Insight Badge for Top 3 */}
                {product.rank <= 3 && (
                  <div className="mt-3 pt-3 border-t border-gray-100">
                    <div className="flex items-center gap-2 text-xs">
                      <div className="px-2 py-1 bg-green-50 text-green-700 rounded-md font-medium flex items-center gap-1">
                        <TrendingUp className="w-3 h-3" />
                        Nên nhập thêm hàng
                      </div>
                      <span className="text-gray-500">
                        Sản phẩm có nhu cầu cao
                      </span>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Footer Summary */}
      {products.length > 0 && (
        <div className="px-6 py-4 bg-gradient-to-r from-blue-50 to-purple-50 border-t border-gray-100">
          <div className="flex items-center justify-between text-sm">
            <div className="flex items-center gap-2 text-gray-700">
              <Award className="w-4 h-4 text-blue-600" />
              <span className="font-medium">Tổng đã bán (Top 5):</span>
            </div>
            <div className="flex items-center gap-4">
              <div className="text-right">
                <p className="text-xs text-gray-500">Số lượng</p>
                <p className="font-bold text-gray-900">
                  {products.reduce((sum, p) => sum + p.total_quantity, 0)} sản
                  phẩm
                </p>
              </div>
              <div className="text-right">
                <p className="text-xs text-gray-500">Lợi nhuận</p>
                <p className="font-bold text-green-600">
                  {formatCurrency(
                    products.reduce((sum, p) => sum + p.total_profit, 0),
                  )}
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
