import { LucideIcon } from "lucide-react";
import { formatCurrency, formatNumber } from "@/lib/utils";

interface StatsCardProps {
  title: string;
  value: string | number;
  icon: LucideIcon;
  iconColor: string;
  bgColor: string;
  isCurrency?: boolean;
}

export function StatsCard({
  title,
  value,
  icon: Icon,
  iconColor,
  bgColor,
  isCurrency = false,
}: StatsCardProps) {
  const displayValue =
    isCurrency && typeof value === "number"
      ? formatCurrency(value)
      : typeof value === "number"
        ? formatNumber(value)
        : value;

  return (
    <div className="bg-white rounded-lg shadow-md p-6 border border-gray-100 hover:shadow-lg transition-shadow">
      <div className="flex items-center justify-between">
        <div className="flex-1">
          <p className="text-sm font-medium text-gray-600 mb-1">{title}</p>
          <p className="text-2xl font-bold text-gray-900">{displayValue}</p>
        </div>
        <div className={`${bgColor} p-3 rounded-lg`}>
          <Icon className={`w-6 h-6 ${iconColor}`} />
        </div>
      </div>
    </div>
  );
}
