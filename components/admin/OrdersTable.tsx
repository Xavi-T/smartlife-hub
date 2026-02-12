"use client";

import { useState } from "react";
import { Eye, Calendar, DollarSign, User, Loader2 } from "lucide-react";
import { formatCurrency } from "@/lib/utils";
import { toast } from "sonner";

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
  status: "pending" | "processing" | "delivered" | "cancelled";
  notes: string | null;
  created_at: string;
  order_items: OrderItem[];
}

interface OrdersTableProps {
  orders: Order[];
  onOrderClick: (order: Order) => void;
  onRefresh: () => void;
}

export function OrdersTable({
  orders,
  onOrderClick,
  onRefresh,
}: OrdersTableProps) {
  const [updatingOrderId, setUpdatingOrderId] = useState<string | null>(null);

  const statusColors = {
    pending: "bg-yellow-100 text-yellow-800 border-yellow-200",
    processing: "bg-blue-100 text-blue-800 border-blue-200",
    delivered: "bg-green-100 text-green-800 border-green-200",
    cancelled: "bg-red-100 text-red-800 border-red-200",
  };

  const statusLabels = {
    pending: "Chờ xác nhận",
    processing: "Đang giao",
    delivered: "Đã giao",
    cancelled: "Đã hủy",
  };

  const handleStatusChange = async (order: Order, newStatus: string) => {
    if (newStatus === order.status) return;

    const confirmMessages = {
      processing: "Xác nhận đơn hàng này? Hàng sẽ được trừ khỏi kho.",
      delivered: "Đánh dấu đơn hàng này đã giao?",
      cancelled: "Hủy đơn hàng này? Hàng sẽ được hoàn về kho.",
    };

    const message = confirmMessages[newStatus as keyof typeof confirmMessages];
    if (message && !confirm(message)) return;

    setUpdatingOrderId(order.id);

    try {
      const response = await fetch("/api/admin/orders/update-status", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orderId: order.id,
          newStatus,
          currentStatus: order.status,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Không thể cập nhật trạng thái");
      }

      toast.success(data.message || "Đã cập nhật trạng thái đơn hàng");
      onRefresh();
    } catch (error: any) {
      toast.error(error.message || "Đã xảy ra lỗi khi cập nhật");
    } finally {
      setUpdatingOrderId(null);
    }
  };

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-100 overflow-hidden">
      <div className="px-6 py-4 border-b border-gray-200">
        <h2 className="text-lg font-semibold text-gray-900">
          Danh sách đơn hàng ({orders.length})
        </h2>
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                Mã đơn
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                Khách hàng
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                Ngày đặt
              </th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                Tổng tiền
              </th>
              <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">
                Trạng thái
              </th>
              <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">
                Hành động
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {orders.map((order) => (
              <tr key={order.id} className="hover:bg-gray-50 transition-colors">
                {/* Order ID */}
                <td className="px-6 py-4">
                  <div className="font-mono text-sm font-semibold text-gray-900">
                    #{order.id.slice(0, 8).toUpperCase()}
                  </div>
                  <div className="text-xs text-gray-500">
                    {order.order_items.length} sản phẩm
                  </div>
                </td>

                {/* Customer */}
                <td className="px-6 py-4">
                  <div className="flex items-start gap-2">
                    <User className="w-4 h-4 text-gray-400 mt-1" />
                    <div>
                      <div className="font-medium text-gray-900">
                        {order.customer_name}
                      </div>
                      <div className="text-sm text-gray-500">
                        {order.customer_phone}
                      </div>
                    </div>
                  </div>
                </td>

                {/* Date */}
                <td className="px-6 py-4">
                  <div className="flex items-center gap-2 text-sm text-gray-900">
                    <Calendar className="w-4 h-4 text-gray-400" />
                    {new Date(order.created_at).toLocaleDateString("vi-VN")}
                  </div>
                  <div className="text-xs text-gray-500">
                    {new Date(order.created_at).toLocaleTimeString("vi-VN")}
                  </div>
                </td>

                {/* Total */}
                <td className="px-6 py-4 text-right">
                  <div className="flex items-center justify-end gap-2">
                    <DollarSign className="w-4 h-4 text-blue-600" />
                    <span className="font-bold text-blue-600">
                      {formatCurrency(order.total_amount)}
                    </span>
                  </div>
                </td>

                {/* Status */}
                <td className="px-6 py-4">
                  <div className="flex justify-center">
                    {updatingOrderId === order.id ? (
                      <div className="flex items-center gap-2 text-sm text-gray-500">
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Đang cập nhật...
                      </div>
                    ) : (
                      <select
                        value={order.status}
                        onChange={(e) =>
                          handleStatusChange(order, e.target.value)
                        }
                        disabled={
                          order.status === "delivered" ||
                          order.status === "cancelled"
                        }
                        className={`px-3 py-1.5 rounded-full text-xs font-semibold border ${
                          statusColors[order.status]
                        } ${
                          order.status === "delivered" ||
                          order.status === "cancelled"
                            ? "cursor-not-allowed opacity-75"
                            : "cursor-pointer hover:opacity-80"
                        }`}
                      >
                        <option value="pending">{statusLabels.pending}</option>
                        <option value="processing">
                          {statusLabels.processing}
                        </option>
                        <option value="delivered">
                          {statusLabels.delivered}
                        </option>
                        <option value="cancelled">
                          {statusLabels.cancelled}
                        </option>
                      </select>
                    )}
                  </div>
                </td>

                {/* Actions */}
                <td className="px-6 py-4 text-center">
                  <button
                    onClick={() => onOrderClick(order)}
                    className="inline-flex items-center gap-2 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors"
                  >
                    <Eye className="w-4 h-4" />
                    Chi tiết
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {orders.length === 0 && (
        <div className="text-center py-12 text-gray-500">
          Chưa có đơn hàng nào
        </div>
      )}
    </div>
  );
}
