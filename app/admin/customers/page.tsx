"use client";

import { useState, useEffect, useMemo } from "react";
import {
  Users,
  RefreshCw,
  Search,
  Filter,
  DollarSign,
  ShoppingBag,
  TrendingUp,
  Award,
} from "lucide-react";
import { CustomersTable } from "@/components/admin/CustomersTable";
import { CustomerDetailModal } from "@/components/admin/CustomerDetailModal";
import { formatCurrency } from "@/lib/utils";

interface Customer {
  phone: string;
  name: string;
  totalOrders: number;
  totalSpent: number;
  deliveredOrders: number;
  lastOrderDate: string;
  firstOrderDate: string;
  customerType: string;
  typeColor: string;
  averageOrderValue: number;
}

interface CustomerStats {
  totalCustomers: number;
  newCustomers: number;
  regularCustomers: number;
  loyalCustomers: number;
  totalRevenue: number;
  averageLTV: number;
}

export default function CustomersPage() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [stats, setStats] = useState<CustomerStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [customerTypeFilter, setCustomerTypeFilter] = useState("all");

  // Detail modal state
  const [selectedPhone, setSelectedPhone] = useState<string | null>(null);
  const [customerDetail, setCustomerDetail] = useState<any>(null);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [isLoadingDetail, setIsLoadingDetail] = useState(false);

  const fetchCustomers = async () => {
    try {
      const params = new URLSearchParams();
      if (searchQuery) params.append("search", searchQuery);
      if (customerTypeFilter !== "all")
        params.append("type", customerTypeFilter);

      const res = await fetch(`/api/admin/customers?${params}`);
      if (!res.ok) throw new Error("Failed to fetch");

      const data = await res.json();
      setCustomers(data.customers);
      setStats(data.stats);
    } catch (error) {
      console.error("Error fetching customers:", error);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    fetchCustomers();
  }, [searchQuery, customerTypeFilter]);

  const handleRefresh = () => {
    setIsRefreshing(true);
    fetchCustomers();
  };

  const handleCustomerClick = async (phone: string) => {
    setSelectedPhone(phone);
    setIsDetailModalOpen(true);
    setIsLoadingDetail(true);

    try {
      const res = await fetch(
        `/api/admin/customers/${encodeURIComponent(phone)}`,
      );
      if (!res.ok) throw new Error("Failed to fetch customer detail");

      const data = await res.json();
      setCustomerDetail(data);
    } catch (error) {
      console.error("Error fetching customer detail:", error);
      alert("Không thể tải thông tin chi tiết khách hàng");
      setIsDetailModalOpen(false);
    } finally {
      setIsLoadingDetail(false);
    }
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
            <div className="flex items-center gap-3">
              <div className="p-3 bg-gradient-to-br from-blue-500 to-purple-600 rounded-xl shadow-lg">
                <Users className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-3xl font-bold text-gray-900">
                  Quản lý Khách hàng
                </h1>
                <p className="mt-1 text-sm text-gray-500">
                  Phân tích và chăm sóc khách hàng
                </p>
              </div>
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
        {/* Stats Cards */}
        {stats && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            <div className="bg-white rounded-lg shadow-sm border border-gray-100 p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600 mb-1">Tổng khách hàng</p>
                  <p className="text-3xl font-bold text-gray-900">
                    {stats.totalCustomers}
                  </p>
                </div>
                <div className="p-3 bg-blue-100 rounded-lg">
                  <Users className="w-6 h-6 text-blue-600" />
                </div>
              </div>
            </div>

            <div className="bg-white rounded-lg shadow-sm border border-gray-100 p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600 mb-1">Khách thân thiết</p>
                  <p className="text-3xl font-bold text-purple-600">
                    {stats.loyalCustomers}
                  </p>
                  <p className="text-xs text-gray-500 mt-1">≥ 3 đơn hàng</p>
                </div>
                <div className="p-3 bg-purple-100 rounded-lg">
                  <Award className="w-6 h-6 text-purple-600" />
                </div>
              </div>
            </div>

            <div className="bg-white rounded-lg shadow-sm border border-gray-100 p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600 mb-1">Tổng doanh thu</p>
                  <p className="text-2xl font-bold text-green-600">
                    {formatCurrency(stats.totalRevenue)}
                  </p>
                </div>
                <div className="p-3 bg-green-100 rounded-lg">
                  <DollarSign className="w-6 h-6 text-green-600" />
                </div>
              </div>
            </div>

            <div className="bg-white rounded-lg shadow-sm border border-gray-100 p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600 mb-1">LTV trung bình</p>
                  <p className="text-2xl font-bold text-blue-600">
                    {formatCurrency(stats.averageLTV)}
                  </p>
                  <p className="text-xs text-gray-500 mt-1">Lifetime Value</p>
                </div>
                <div className="p-3 bg-blue-100 rounded-lg">
                  <TrendingUp className="w-6 h-6 text-blue-600" />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Filters */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-100 p-4 mb-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Search */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Tìm theo tên hoặc SĐT..."
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            {/* Customer Type Filter */}
            <div className="relative">
              <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <select
                value={customerTypeFilter}
                onChange={(e) => setCustomerTypeFilter(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent appearance-none"
              >
                <option value="all">Tất cả khách hàng</option>
                <option value="new">Khách mới (1 đơn)</option>
                <option value="regular">Khách quen (2 đơn)</option>
                <option value="loyal">Khách thân thiết (≥3 đơn)</option>
              </select>
            </div>
          </div>
        </div>

        {/* Customers Table */}
        <CustomersTable
          customers={customers}
          onCustomerClick={handleCustomerClick}
        />
      </div>

      {/* Customer Detail Modal */}
      {isDetailModalOpen && !isLoadingDetail && customerDetail && (
        <CustomerDetailModal
          isOpen={isDetailModalOpen}
          onClose={() => setIsDetailModalOpen(false)}
          customer={customerDetail.customer}
          stats={customerDetail.stats}
          orders={customerDetail.orders}
        />
      )}
    </div>
  );
}
