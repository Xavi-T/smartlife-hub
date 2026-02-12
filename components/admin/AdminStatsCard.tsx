"use client";

import { TrendingUp, TrendingDown } from "lucide-react";
import { formatCurrency } from "@/lib/utils";

interface StatsCardProps {
  title: string;
  value: number;
  icon: React.ReactNode;
  isCurrency?: boolean;
  growth?: number;
  subtitle?: string;
}

export function AdminStatsCard({
  title,
  value,
  icon,
  isCurrency = false,
  growth,
  subtitle,
}: StatsCardProps) {
  const displayValue = isCurrency
    ? formatCurrency(value)
    : value.toLocaleString("vi-VN");

  const isPositiveGrowth = growth !== undefined && growth >= 0;

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between mb-4">
        <div className="p-3 bg-blue-50 rounded-lg">{icon}</div>
        {growth !== undefined && (
          <div
            className={`flex items-center gap-1 text-sm font-semibold ${
              isPositiveGrowth ? "text-green-600" : "text-red-600"
            }`}
          >
            {isPositiveGrowth ? (
              <TrendingUp className="w-4 h-4" />
            ) : (
              <TrendingDown className="w-4 h-4" />
            )}
            {Math.abs(growth).toFixed(1)}%
          </div>
        )}
      </div>

      <div>
        <p className="text-sm text-gray-600 mb-1">{title}</p>
        <p className="text-3xl font-bold text-gray-900 mb-1">{displayValue}</p>
        {subtitle && <p className="text-xs text-gray-500">{subtitle}</p>}
      </div>
    </div>
  );
}
