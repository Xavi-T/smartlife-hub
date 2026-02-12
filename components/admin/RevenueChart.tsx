"use client";

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { formatCurrency } from "@/lib/utils";

interface ChartData {
  date: string;
  revenue: number;
  orders: number;
}

interface RevenueChartProps {
  data: ChartData[];
}

export function RevenueChart({ data }: RevenueChartProps) {
  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
      <div className="mb-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-1">
          Doanh thu 7 ngày gần nhất
        </h3>
        <p className="text-sm text-gray-500">
          Biểu đồ theo dõi doanh thu từ đơn hàng đã giao
        </p>
      </div>

      <ResponsiveContainer width="100%" height={300}>
        <LineChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
          <XAxis dataKey="date" stroke="#9ca3af" style={{ fontSize: "12px" }} />
          <YAxis
            stroke="#9ca3af"
            style={{ fontSize: "12px" }}
            tickFormatter={(value) => `${(value / 1000000).toFixed(1)}M`}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: "#fff",
              border: "1px solid #e5e7eb",
              borderRadius: "8px",
              padding: "12px",
            }}
            formatter={(value: number, name: string) => {
              if (name === "revenue") {
                return [formatCurrency(value), "Doanh thu"];
              }
              return [value, "Đơn hàng"];
            }}
          />
          <Line
            type="monotone"
            dataKey="revenue"
            stroke="#3b82f6"
            strokeWidth={3}
            dot={{ fill: "#3b82f6", r: 4 }}
            activeDot={{ r: 6 }}
          />
        </LineChart>
      </ResponsiveContainer>

      <div className="mt-4 pt-4 border-t border-gray-100">
        <div className="flex items-center justify-between text-sm">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-blue-500"></div>
            <span className="text-gray-600">Doanh thu (VNĐ)</span>
          </div>
          <span className="text-gray-900 font-semibold">
            {formatCurrency(data.reduce((sum, item) => sum + item.revenue, 0))}
          </span>
        </div>
      </div>
    </div>
  );
}
