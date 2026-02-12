"use client";

import { useState, useEffect } from "react";
import {
  Package,
  Calendar,
  DollarSign,
  Truck,
  FileText,
  TrendingUp,
} from "lucide-react";
import { formatCurrency } from "@/lib/utils";

interface StockInbound {
  id: string;
  product_id: string;
  quantity_added: number;
  cost_price_at_time: number;
  supplier: string | null;
  notes: string | null;
  created_at: string;
  products: {
    id: string;
    name: string;
    image_url: string | null;
    category: string;
  };
}

interface StockInboundHistoryProps {
  productId?: string;
  limit?: number;
}

export function StockInboundHistory({
  productId,
  limit = 50,
}: StockInboundHistoryProps) {
  const [inbounds, setInbounds] = useState<StockInbound[]>([]);
  const [stats, setStats] = useState({
    totalRecords: 0,
    totalQuantity: 0,
    totalValue: 0,
  });
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchHistory();
  }, [productId]);

  const fetchHistory = async () => {
    try {
      const params = new URLSearchParams();
      if (productId) params.append("productId", productId);
      params.append("limit", limit.toString());

      const res = await fetch(`/api/admin/stock-inbound?${params}`);
      if (!res.ok) throw new Error("Failed to fetch");

      const data = await res.json();
      setInbounds(data.inbounds);
      setStats(data.stats);
    } catch (error) {
      console.error("Error fetching inbound history:", error);
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return (
      <div className="bg-white rounded-lg shadow-sm border border-gray-100 p-6">
        <div className="text-center py-8 text-gray-500">Đang tải...</div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-100">
      {/* Header */}
      <div className="px-6 py-4 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 rounded-lg">
              <Package className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-gray-900">
                Lịch sử nhập hàng
              </h2>
              <p className="text-xs text-gray-500">
                {stats.totalRecords} lần nhập • {stats.totalQuantity} sản phẩm
              </p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-xs text-gray-500 mb-1">Tổng giá trị</p>
            <p className="text-lg font-bold text-blue-600">
              {formatCurrency(stats.totalValue)}
            </p>
          </div>
        </div>
      </div>

      {/* History List */}
      <div className="divide-y divide-gray-100">
        {inbounds.length === 0 ? (
          <div className="text-center py-12 text-gray-500">
            Chưa có lịch sử nhập hàng
          </div>
        ) : (
          inbounds.map((inbound) => (
            <div
              key={inbound.id}
              className="px-6 py-4 hover:bg-gray-50 transition-colors"
            >
              <div className="flex items-start gap-4">
                {/* Product Image */}
                {inbound.products.image_url ? (
                  <img
                    src={inbound.products.image_url}
                    alt={inbound.products.name}
                    className="w-12 h-12 object-cover rounded-lg shadow-sm flex-shrink-0"
                  />
                ) : (
                  <div className="w-12 h-12 bg-gray-200 rounded-lg flex items-center justify-center flex-shrink-0">
                    📦
                  </div>
                )}

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-4 mb-2">
                    <div>
                      <h3 className="font-semibold text-gray-900 truncate">
                        {inbound.products.name}
                      </h3>
                      <p className="text-xs text-gray-500">
                        {inbound.products.category}
                      </p>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className="text-sm font-bold text-blue-600">
                        {formatCurrency(
                          inbound.quantity_added * inbound.cost_price_at_time,
                        )}
                      </p>
                      <p className="text-xs text-gray-500">Tổng giá trị</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                    <div className="flex items-center gap-2">
                      <Package className="w-4 h-4 text-gray-400" />
                      <div>
                        <p className="text-gray-600 text-xs">Số lượng</p>
                        <p className="font-semibold text-gray-900">
                          +{inbound.quantity_added}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <DollarSign className="w-4 h-4 text-gray-400" />
                      <div>
                        <p className="text-gray-600 text-xs">Giá vốn</p>
                        <p className="font-semibold text-gray-900">
                          {formatCurrency(inbound.cost_price_at_time)}
                        </p>
                      </div>
                    </div>

                    {inbound.supplier && (
                      <div className="flex items-center gap-2">
                        <Truck className="w-4 h-4 text-gray-400" />
                        <div>
                          <p className="text-gray-600 text-xs">Nhà cung cấp</p>
                          <p className="font-semibold text-gray-900 truncate">
                            {inbound.supplier}
                          </p>
                        </div>
                      </div>
                    )}

                    <div className="flex items-center gap-2">
                      <Calendar className="w-4 h-4 text-gray-400" />
                      <div>
                        <p className="text-gray-600 text-xs">Ngày nhập</p>
                        <p className="font-semibold text-gray-900">
                          {new Date(inbound.created_at).toLocaleDateString(
                            "vi-VN",
                          )}
                        </p>
                      </div>
                    </div>
                  </div>

                  {inbound.notes && (
                    <div className="mt-2 flex items-start gap-2 text-sm">
                      <FileText className="w-4 h-4 text-gray-400 flex-shrink-0 mt-0.5" />
                      <p className="text-gray-600 italic">{inbound.notes}</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
