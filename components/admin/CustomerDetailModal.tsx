"use client";

import {
  X,
  User,
  Phone,
  MapPin,
  Calendar,
  ShoppingBag,
  DollarSign,
  TrendingUp,
  Package,
} from "lucide-react";
import { formatCurrency } from "@/lib/utils";

interface OrderItem {
  id: string;
  quantity: number;
  unit_price: number;
  subtotal: number;
  products: {
    id: string;
    name: string;
    image_url: string | null;
    category: string;
  };
}

interface Order {
  id: string;
  customer_name: string;
  customer_phone: string;
  customer_address: string;
  total_amount: number;
  status: string;
  notes: string | null;
  created_at: string;
  order_items: OrderItem[];
}

interface CustomerStats {
  totalOrders: number;
  totalSpent: number;
  pendingOrders: number;
  processingOrders: number;
  deliveredOrders: number;
  cancelledOrders: number;
  averageOrderValue: number;
  firstOrderDate: string | null;
  lastOrderDate: string | null;
}

interface CustomerInfo {
  name: string;
  phone: string;
  address: string;
  customerType: string;
  typeColor: string;
}

interface CustomerDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  customer: CustomerInfo | null;
  stats: CustomerStats | null;
  orders: Order[];
}

export function CustomerDetailModal({
  isOpen,
  onClose,
  customer,
  stats,
  orders,
}: CustomerDetailModalProps) {
  if (!isOpen || !customer || !stats) return null;

  const statusColors = {
    pending: "bg-yellow-100 text-yellow-800",
    processing: "bg-blue-100 text-blue-800",
    delivered: "bg-green-100 text-green-800",
    cancelled: "bg-red-100 text-red-800",
  };

  const statusLabels = {
    pending: "Chờ xác nhận",
    processing: "Đang giao",
    delivered: "Đã giao",
    cancelled: "Đã hủy",
  };

  const getTypeColorClass = (color: string) => {
    const colors: Record<string, string> = {
      yellow: "bg-yellow-100 text-yellow-800 border-yellow-300",
      blue: "bg-blue-100 text-blue-800 border-blue-300",
      purple: "bg-purple-100 text-purple-800 border-purple-300",
    };
    return colors[color] || colors.blue;
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black bg-opacity-50" onClick={onClose} />

      {/* Modal */}
      <div className="relative min-h-screen flex items-center justify-center p-4">
        <div className="relative bg-white rounded-xl shadow-2xl max-w-5xl w-full max-h-[90vh] overflow-y-auto">
          {/* Header */}
          <div className="sticky top-0 bg-gradient-to-r from-blue-600 to-purple-600 px-6 py-4 flex items-center justify-between z-10">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-white/20 rounded-lg backdrop-blur">
                <User className="w-6 h-6 text-white" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-white">
                  {customer.name}
                </h2>
                <p className="text-sm text-blue-100 flex items-center gap-2">
                  <Phone className="w-3 h-3" />
                  {customer.phone}
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-white/20 rounded-lg transition-colors"
            >
              <X className="w-5 h-5 text-white" />
            </button>
          </div>

          {/* Body */}
          <div className="p-6 space-y-6">
            {/* Customer Type Badge */}
            <div className="flex items-center justify-between">
              <span
                className={`inline-flex items-center px-4 py-2 rounded-full text-sm font-semibold border-2 ${getTypeColorClass(
                  customer.typeColor,
                )}`}
              >
                {customer.customerType}
              </span>
              <div className="text-right">
                <p className="text-xs text-gray-500">Khách hàng từ</p>
                <p className="font-semibold text-gray-900">
                  {stats.firstOrderDate
                    ? new Date(stats.firstOrderDate).toLocaleDateString("vi-VN")
                    : "N/A"}
                </p>
              </div>
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-lg p-4 border border-blue-200">
                <div className="flex items-center gap-2 mb-2">
                  <ShoppingBag className="w-5 h-5 text-blue-600" />
                  <p className="text-sm text-blue-900 font-medium">Tổng đơn</p>
                </div>
                <p className="text-2xl font-bold text-blue-900">
                  {stats.totalOrders}
                </p>
                <p className="text-xs text-blue-700 mt-1">
                  {stats.deliveredOrders} đã giao
                </p>
              </div>

              <div className="bg-gradient-to-br from-green-50 to-green-100 rounded-lg p-4 border border-green-200">
                <div className="flex items-center gap-2 mb-2">
                  <DollarSign className="w-5 h-5 text-green-600" />
                  <p className="text-sm text-green-900 font-medium">LTV</p>
                </div>
                <p className="text-xl font-bold text-green-900">
                  {formatCurrency(stats.totalSpent)}
                </p>
                <p className="text-xs text-green-700 mt-1">Lifetime Value</p>
              </div>

              <div className="bg-gradient-to-br from-purple-50 to-purple-100 rounded-lg p-4 border border-purple-200">
                <div className="flex items-center gap-2 mb-2">
                  <TrendingUp className="w-5 h-5 text-purple-600" />
                  <p className="text-sm text-purple-900 font-medium">TB/đơn</p>
                </div>
                <p className="text-lg font-bold text-purple-900">
                  {formatCurrency(stats.averageOrderValue)}
                </p>
                <p className="text-xs text-purple-700 mt-1">
                  Giá trị trung bình
                </p>
              </div>

              <div className="bg-gradient-to-br from-gray-50 to-gray-100 rounded-lg p-4 border border-gray-200">
                <div className="flex items-center gap-2 mb-2">
                  <Calendar className="w-5 h-5 text-gray-600" />
                  <p className="text-sm text-gray-900 font-medium">Đơn cuối</p>
                </div>
                <p className="text-sm font-bold text-gray-900">
                  {stats.lastOrderDate
                    ? new Date(stats.lastOrderDate).toLocaleDateString("vi-VN")
                    : "N/A"}
                </p>
                <p className="text-xs text-gray-700 mt-1">
                  {stats.lastOrderDate
                    ? Math.floor(
                        (Date.now() - new Date(stats.lastOrderDate).getTime()) /
                          (1000 * 60 * 60 * 24),
                      ) + " ngày trước"
                    : "N/A"}
                </p>
              </div>
            </div>

            {/* Address */}
            <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
              <div className="flex items-start gap-2">
                <MapPin className="w-5 h-5 text-gray-400 mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-gray-900">
                    Địa chỉ giao hàng
                  </p>
                  <p className="text-sm text-gray-600 mt-1">
                    {customer.address}
                  </p>
                </div>
              </div>
            </div>

            {/* Orders History */}
            <div>
              <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                <Package className="w-5 h-5 text-blue-600" />
                Lịch sử đơn hàng ({orders.length})
              </h3>

              <div className="space-y-3 max-h-96 overflow-y-auto">
                {orders.map((order) => (
                  <div
                    key={order.id}
                    className="bg-gray-50 rounded-lg p-4 border border-gray-200 hover:border-blue-300 transition-colors"
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <p className="font-mono text-sm font-semibold text-gray-900">
                          #{order.id.slice(0, 8).toUpperCase()}
                        </p>
                        <p className="text-xs text-gray-500">
                          {new Date(order.created_at).toLocaleString("vi-VN")}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="font-bold text-blue-600">
                          {formatCurrency(order.total_amount)}
                        </p>
                        <span
                          className={`inline-block px-2 py-0.5 rounded-full text-xs font-semibold mt-1 ${
                            statusColors[
                              order.status as keyof typeof statusColors
                            ]
                          }`}
                        >
                          {
                            statusLabels[
                              order.status as keyof typeof statusLabels
                            ]
                          }
                        </span>
                      </div>
                    </div>

                    {/* Order Items */}
                    <div className="space-y-2">
                      {order.order_items.slice(0, 3).map((item) => (
                        <div
                          key={item.id}
                          className="flex items-center gap-2 text-sm"
                        >
                          <span className="text-gray-600">
                            {item.quantity}x
                          </span>
                          <span className="text-gray-900">
                            {item.products.name}
                          </span>
                        </div>
                      ))}
                      {order.order_items.length > 3 && (
                        <p className="text-xs text-gray-500 italic">
                          +{order.order_items.length - 3} sản phẩm khác
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
