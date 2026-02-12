"use client";

import { useState, useEffect } from "react";
import {
  RefreshCw,
  History,
  Filter,
  Package,
  ShoppingBag,
  TrendingUp,
  Activity,
} from "lucide-react";
import { AuditLogTimeline } from "@/components/admin/AuditLogTimeline";

interface AuditLog {
  id: string;
  event_type: string;
  entity_type: string;
  entity_id: string | null;
  actor: string;
  action: string;
  description: string;
  old_values: any;
  new_values: any;
  metadata: any;
  created_at: string;
}

interface Stats {
  totalLogs: number;
  productEvents: number;
  orderEvents: number;
  stockEvents: number;
  todayLogs: number;
}

export default function AuditLogsPage() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [groupedLogs, setGroupedLogs] = useState<Record<string, AuditLog[]>>(
    {},
  );
  const [stats, setStats] = useState<Stats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [eventTypeFilter, setEventTypeFilter] = useState("all");
  const [entityTypeFilter, setEntityTypeFilter] = useState("all");

  const fetchLogs = async () => {
    try {
      const params = new URLSearchParams();
      params.append("limit", "100");
      if (eventTypeFilter !== "all")
        params.append("eventType", eventTypeFilter);
      if (entityTypeFilter !== "all")
        params.append("entityType", entityTypeFilter);

      const res = await fetch(`/api/admin/audit-logs?${params}`);
      if (!res.ok) throw new Error("Failed to fetch");

      const data = await res.json();
      setLogs(data.logs);
      setGroupedLogs(data.groupedLogs);
      setStats(data.stats);
    } catch (error) {
      console.error("Error fetching audit logs:", error);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, [eventTypeFilter, entityTypeFilter]);

  const handleRefresh = () => {
    setIsRefreshing(true);
    fetchLogs();
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
                <History className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-3xl font-bold text-gray-900">
                  Nhật ký Hoạt động
                </h1>
                <p className="mt-1 text-sm text-gray-500">
                  Theo dõi mọi thay đổi trong hệ thống
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
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6 mb-8">
            <div className="bg-white rounded-lg shadow-sm border border-gray-100 p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600 mb-1">Tổng sự kiện</p>
                  <p className="text-3xl font-bold text-gray-900">
                    {stats.totalLogs}
                  </p>
                </div>
                <div className="p-3 bg-gray-100 rounded-lg">
                  <Activity className="w-6 h-6 text-gray-600" />
                </div>
              </div>
            </div>

            <div className="bg-white rounded-lg shadow-sm border border-gray-100 p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600 mb-1">Hôm nay</p>
                  <p className="text-3xl font-bold text-blue-600">
                    {stats.todayLogs}
                  </p>
                </div>
                <div className="p-3 bg-blue-100 rounded-lg">
                  <Activity className="w-6 h-6 text-blue-600" />
                </div>
              </div>
            </div>

            <div className="bg-white rounded-lg shadow-sm border border-gray-100 p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600 mb-1">Sản phẩm</p>
                  <p className="text-3xl font-bold text-blue-600">
                    {stats.productEvents}
                  </p>
                </div>
                <div className="p-3 bg-blue-100 rounded-lg">
                  <Package className="w-6 h-6 text-blue-600" />
                </div>
              </div>
            </div>

            <div className="bg-white rounded-lg shadow-sm border border-gray-100 p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600 mb-1">Đơn hàng</p>
                  <p className="text-3xl font-bold text-green-600">
                    {stats.orderEvents}
                  </p>
                </div>
                <div className="p-3 bg-green-100 rounded-lg">
                  <ShoppingBag className="w-6 h-6 text-green-600" />
                </div>
              </div>
            </div>

            <div className="bg-white rounded-lg shadow-sm border border-gray-100 p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600 mb-1">Kho hàng</p>
                  <p className="text-3xl font-bold text-purple-600">
                    {stats.stockEvents}
                  </p>
                </div>
                <div className="p-3 bg-purple-100 rounded-lg">
                  <TrendingUp className="w-6 h-6 text-purple-600" />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Filters */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-100 p-4 mb-6">
          <div className="flex items-center gap-3 mb-3">
            <Filter className="w-5 h-5 text-gray-400" />
            <h3 className="font-semibold text-gray-900">Bộ lọc</h3>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Entity Type Filter */}
            <select
              value={entityTypeFilter}
              onChange={(e) => setEntityTypeFilter(e.target.value)}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="all">Tất cả đối tượng</option>
              <option value="product">Sản phẩm</option>
              <option value="order">Đơn hàng</option>
              <option value="system">Hệ thống</option>
            </select>

            {/* Event Type Filter */}
            <select
              value={eventTypeFilter}
              onChange={(e) => setEventTypeFilter(e.target.value)}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="all">Tất cả sự kiện</option>
              <option value="product.created">Tạo sản phẩm</option>
              <option value="product.updated">Cập nhật sản phẩm</option>
              <option value="product.price_updated">Thay đổi giá</option>
              <option value="product.stock_updated">Thay đổi tồn kho</option>
              <option value="order.created">Tạo đơn hàng</option>
              <option value="order.status_changed">Đổi trạng thái đơn</option>
              <option value="stock.inbound">Nhập hàng</option>
            </select>
          </div>
        </div>

        {/* Timeline */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-100 p-6">
          <AuditLogTimeline logs={logs} groupedLogs={groupedLogs} />
        </div>
      </div>
    </div>
  );
}
