"use client";

import { useEffect, useState } from "react";
import {
  DollarSign,
  TrendingUp,
  ShoppingCart,
  AlertTriangle,
  RefreshCw,
} from "lucide-react";
import { StatsCard } from "@/components/admin/StatsCard";
import { ProductTable } from "@/components/admin/ProductTable";
import { QuickStockForm } from "@/components/admin/QuickStockForm";
import type { Product, DashboardStats } from "@/types/database";

export default function AdminDashboard() {
  const [products, setProducts] = useState<Product[]>([]);
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const fetchData = async () => {
    try {
      const [productsRes, statsRes] = await Promise.all([
        fetch("/api/products"),
        fetch("/api/stats"),
      ]);

      if (!productsRes.ok || !statsRes.ok) {
        throw new Error("Failed to fetch data");
      }

      const [productsData, statsData] = await Promise.all([
        productsRes.json(),
        statsRes.json(),
      ]);

      setProducts(productsData);
      setStats(statsData);
    } catch (error) {
      console.error("Error fetching data:", error);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleRefresh = () => {
    setIsRefreshing(true);
    fetchData();
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <RefreshCw className="w-8 h-8 text-blue-600 animate-spin mx-auto mb-4" />
          <p className="text-gray-600">Đang tải dữ liệu...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">
                Admin Dashboard
              </h1>
              <p className="mt-1 text-sm text-gray-500">
                Quản lý sản phẩm và theo dõi doanh thu
              </p>
            </div>
            <button
              onClick={handleRefresh}
              disabled={isRefreshing}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors disabled:opacity-50"
            >
              <RefreshCw
                className={`w-4 h-4 ${isRefreshing ? "animate-spin" : ""}`}
              />
              Làm mới
            </button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Statistics Cards */}
        {stats && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            <StatsCard
              title="Tổng doanh thu"
              value={stats.totalRevenue}
              icon={DollarSign}
              iconColor="text-green-600"
              bgColor="bg-green-100"
              isCurrency
            />
            <StatsCard
              title="Tổng lợi nhuận"
              value={stats.totalProfit}
              icon={TrendingUp}
              iconColor="text-blue-600"
              bgColor="bg-blue-100"
              isCurrency
            />
            <StatsCard
              title="Đơn hàng tháng này"
              value={stats.monthlyOrders}
              icon={ShoppingCart}
              iconColor="text-purple-600"
              bgColor="bg-purple-100"
            />
            <StatsCard
              title="Sản phẩm sắp hết"
              value={stats.lowStockProducts}
              icon={AlertTriangle}
              iconColor="text-red-600"
              bgColor="bg-red-100"
            />
          </div>
        )}

        {/* Two Column Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Product Table - 2 columns */}
          <div className="lg:col-span-2">
            <ProductTable products={products} />
          </div>

          {/* Quick Stock Form - 1 column */}
          <div className="lg:col-span-1">
            <QuickStockForm
              products={products}
              onStockUpdated={handleRefresh}
            />
          </div>
        </div>

        {/* Low Stock Alert */}
        {stats && stats.lowStockProducts > 0 && (
          <div className="mt-6 bg-red-50 border border-red-200 rounded-lg p-4">
            <div className="flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-red-600 mt-0.5" />
              <div>
                <h3 className="text-sm font-semibold text-red-900">
                  Cảnh báo tồn kho thấp
                </h3>
                <p className="text-sm text-red-700 mt-1">
                  Có {stats.lowStockProducts} sản phẩm có số lượng tồn kho dưới
                  5. Vui lòng nhập hàng để tránh thiếu hàng.
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
