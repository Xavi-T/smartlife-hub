"use client";

import {
  X,
  Package,
  User,
  Phone,
  MapPin,
  Calendar,
  DollarSign,
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

interface OrderDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  order: Order | null;
}

export function OrderDetailModal({
  isOpen,
  onClose,
  order,
}: OrderDetailModalProps) {
  if (!isOpen || !order) return null;

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

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black bg-opacity-50" onClick={onClose} />

      {/* Modal */}
      <div className="relative min-h-screen flex items-center justify-center p-4">
        <div className="relative bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
          {/* Header */}
          <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-bold text-gray-900">
                Chi tiết đơn hàng
              </h2>
              <p className="text-sm text-gray-500 mt-1">
                #{order.id.slice(0, 8).toUpperCase()}
              </p>
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Body */}
          <div className="p-6 space-y-6">
            {/* Order Info */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Customer Info */}
              <div className="bg-gray-50 rounded-lg p-4">
                <h3 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
                  <User className="w-5 h-5 text-blue-600" />
                  Thông tin khách hàng
                </h3>
                <div className="space-y-2 text-sm">
                  <div className="flex items-start gap-2">
                    <User className="w-4 h-4 text-gray-400 mt-0.5" />
                    <div>
                      <p className="text-gray-600">Tên khách hàng</p>
                      <p className="font-medium text-gray-900">
                        {order.customer_name}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-start gap-2">
                    <Phone className="w-4 h-4 text-gray-400 mt-0.5" />
                    <div>
                      <p className="text-gray-600">Số điện thoại</p>
                      <p className="font-medium text-gray-900">
                        {order.customer_phone}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-start gap-2">
                    <MapPin className="w-4 h-4 text-gray-400 mt-0.5" />
                    <div>
                      <p className="text-gray-600">Địa chỉ giao hàng</p>
                      <p className="font-medium text-gray-900">
                        {order.customer_address}
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Order Info */}
              <div className="bg-gray-50 rounded-lg p-4">
                <h3 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
                  <Package className="w-5 h-5 text-blue-600" />
                  Thông tin đơn hàng
                </h3>
                <div className="space-y-2 text-sm">
                  <div className="flex items-start gap-2">
                    <Calendar className="w-4 h-4 text-gray-400 mt-0.5" />
                    <div>
                      <p className="text-gray-600">Ngày đặt hàng</p>
                      <p className="font-medium text-gray-900">
                        {new Date(order.created_at).toLocaleString("vi-VN")}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-start gap-2">
                    <Package className="w-4 h-4 text-gray-400 mt-0.5" />
                    <div>
                      <p className="text-gray-600">Trạng thái</p>
                      <span
                        className={`inline-block px-3 py-1 rounded-full text-xs font-semibold ${statusColors[order.status as keyof typeof statusColors]}`}
                      >
                        {
                          statusLabels[
                            order.status as keyof typeof statusLabels
                          ]
                        }
                      </span>
                    </div>
                  </div>
                  <div className="flex items-start gap-2">
                    <DollarSign className="w-4 h-4 text-gray-400 mt-0.5" />
                    <div>
                      <p className="text-gray-600">Tổng tiền</p>
                      <p className="font-bold text-blue-600 text-lg">
                        {formatCurrency(order.total_amount)}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Notes */}
            {order.notes && (
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                <h3 className="font-semibold text-gray-900 mb-2">Ghi chú</h3>
                <p className="text-sm text-gray-700">{order.notes}</p>
              </div>
            )}

            {/* Order Items */}
            <div>
              <h3 className="font-semibold text-gray-900 mb-3">
                Danh sách sản phẩm ({order.order_items.length})
              </h3>
              <div className="border border-gray-200 rounded-lg overflow-hidden">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                        Sản phẩm
                      </th>
                      <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">
                        Số lượng
                      </th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                        Đơn giá
                      </th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                        Thành tiền
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {order.order_items.map((item) => (
                      <tr key={item.id}>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-3">
                            {item.products.image_url ? (
                              <img
                                src={item.products.image_url}
                                alt={item.products.name}
                                className="w-12 h-12 object-cover rounded-lg"
                              />
                            ) : (
                              <div className="w-12 h-12 bg-gray-200 rounded-lg flex items-center justify-center">
                                📦
                              </div>
                            )}
                            <div>
                              <p className="font-medium text-gray-900">
                                {item.products.name}
                              </p>
                              <p className="text-xs text-gray-500">
                                {item.products.category}
                              </p>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-center font-semibold text-gray-900">
                          {item.quantity}
                        </td>
                        <td className="px-4 py-3 text-right text-gray-900">
                          {formatCurrency(item.unit_price)}
                        </td>
                        <td className="px-4 py-3 text-right font-semibold text-blue-600">
                          {formatCurrency(item.subtotal)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="bg-gray-50">
                    <tr>
                      <td
                        colSpan={3}
                        className="px-4 py-3 text-right font-bold text-gray-900"
                      >
                        Tổng cộng:
                      </td>
                      <td className="px-4 py-3 text-right font-bold text-blue-600 text-lg">
                        {formatCurrency(order.total_amount)}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
