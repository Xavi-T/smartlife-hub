"use client";

import { Users, Phone, ShoppingBag, DollarSign, Eye } from "lucide-react";
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

interface CustomersTableProps {
  customers: Customer[];
  onCustomerClick: (phone: string) => void;
}

export function CustomersTable({
  customers,
  onCustomerClick,
}: CustomersTableProps) {
  const getTypeColorClass = (color: string) => {
    const colors: Record<string, string> = {
      yellow: "bg-yellow-100 text-yellow-800 border-yellow-200",
      blue: "bg-blue-100 text-blue-800 border-blue-200",
      purple: "bg-purple-100 text-purple-800 border-purple-200",
    };
    return colors[color] || colors.blue;
  };

  const formatDaysSinceLastOrder = (lastOrderDate: string) => {
    const days = Math.floor(
      (Date.now() - new Date(lastOrderDate).getTime()) / (1000 * 60 * 60 * 24),
    );

    if (days === 0) return "Hôm nay";
    if (days === 1) return "Hôm qua";
    if (days < 7) return `${days} ngày trước`;
    if (days < 30) return `${Math.floor(days / 7)} tuần trước`;
    return `${Math.floor(days / 30)} tháng trước`;
  };

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-100 overflow-hidden">
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                Khách hàng
              </th>
              <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">
                Phân loại
              </th>
              <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">
                Tổng đơn
              </th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                LTV
              </th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                Giá trị TB/đơn
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                Đơn cuối
              </th>
              <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">
                Hành động
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {customers.map((customer) => (
              <tr
                key={customer.phone}
                className="hover:bg-gray-50 transition-colors"
              >
                {/* Customer Info */}
                <td className="px-6 py-4">
                  <div className="flex items-center gap-3">
                    <div className="flex-shrink-0 w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center">
                      <Users className="w-5 h-5 text-white" />
                    </div>
                    <div>
                      <div className="font-semibold text-gray-900">
                        {customer.name}
                      </div>
                      <div className="flex items-center gap-1 text-sm text-gray-500">
                        <Phone className="w-3 h-3" />
                        {customer.phone}
                      </div>
                    </div>
                  </div>
                </td>

                {/* Customer Type */}
                <td className="px-6 py-4 text-center">
                  <span
                    className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold border ${getTypeColorClass(
                      customer.typeColor,
                    )}`}
                  >
                    {customer.customerType}
                  </span>
                </td>

                {/* Total Orders */}
                <td className="px-6 py-4 text-center">
                  <div className="flex items-center justify-center gap-2">
                    <ShoppingBag className="w-4 h-4 text-blue-600" />
                    <span className="font-bold text-gray-900">
                      {customer.totalOrders}
                    </span>
                  </div>
                  <div className="text-xs text-gray-500">
                    {customer.deliveredOrders} đã giao
                  </div>
                </td>

                {/* LTV */}
                <td className="px-6 py-4 text-right">
                  <div className="font-bold text-green-600">
                    {formatCurrency(customer.totalSpent)}
                  </div>
                  <div className="text-xs text-gray-500">Lifetime Value</div>
                </td>

                {/* Average Order Value */}
                <td className="px-6 py-4 text-right">
                  <div className="font-semibold text-gray-900">
                    {formatCurrency(customer.averageOrderValue)}
                  </div>
                </td>

                {/* Last Order */}
                <td className="px-6 py-4">
                  <div className="text-sm text-gray-900">
                    {new Date(customer.lastOrderDate).toLocaleDateString(
                      "vi-VN",
                    )}
                  </div>
                  <div className="text-xs text-gray-500">
                    {formatDaysSinceLastOrder(customer.lastOrderDate)}
                  </div>
                </td>

                {/* Actions */}
                <td className="px-6 py-4 text-center">
                  <button
                    onClick={() => onCustomerClick(customer.phone)}
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

      {customers.length === 0 && (
        <div className="text-center py-12 text-gray-500">
          Không tìm thấy khách hàng
        </div>
      )}
    </div>
  );
}
