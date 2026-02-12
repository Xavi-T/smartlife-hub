"use client";

import { useEffect, useState } from "react";
import { Card, Row, Col, Statistic, Button, Alert, Spin, Space } from "antd";
import {
  DollarOutlined,
  RiseOutlined,
  ShoppingCartOutlined,
  ReloadOutlined,
  WalletOutlined,
  WarningOutlined,
} from "@ant-design/icons";
import { RevenueChart } from "@/components/admin/RevenueChart";
import { ProductTable } from "@/components/admin/ProductTable";
import { QuickStockForm } from "@/components/admin/QuickStockForm";
import { TopSellingProducts } from "@/components/admin/TopSellingProducts";
import type { Product } from "@/types/database";

interface AdminStats {
  totalRevenue: number;
  totalProfit: number;
  growthRate: number;
  monthlyRevenue: number;
  previousMonthRevenue: number;
}

interface ChartData {
  date: string;
  revenue: number;
  orders: number;
}

export default function AdminDashboard() {
  const [products, setProducts] = useState<Product[]>([]);
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [chartData, setChartData] = useState<ChartData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const fetchData = async () => {
    try {
      const [productsRes, statsRes, chartRes] = await Promise.all([
        fetch("/api/products"),
        fetch("/api/admin/stats"),
        fetch("/api/admin/chart"),
      ]);

      if (!productsRes.ok || !statsRes.ok || !chartRes.ok) {
        throw new Error("Failed to fetch data");
      }

      const [productsData, statsData, chartDataRes] = await Promise.all([
        productsRes.json(),
        statsRes.json(),
        chartRes.json(),
      ]);

      setProducts(productsData);
      setStats(statsData);
      setChartData(chartDataRes);
    } catch (error) {
      console.error("Error fetching data:", error);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleRefresh = () => {
    setIsRefreshing(true);
    fetchData();
  };

  const lowStockProducts = products.filter(
    (p) => p.stock_quantity < 5 && p.is_active,
  );

  if (isLoading) {
    return (
      <div
        style={{
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#f5f5f5",
        }}
      >
        <Space orientation="vertical" align="center">
          <Spin size="large" />
          <div style={{ color: "#8c8c8c" }}>Đang tải dữ liệu...</div>
        </Space>
      </div>
    );
  }

  return (
    <div style={{ background: "#f5f5f5", minHeight: "100vh" }}>
      {/* Header with Refresh Button */}
      <div
        style={{
          marginBottom: 24,
          display: "flex",
          justifyContent: "flex-end",
        }}
      >
        <Button
          icon={<ReloadOutlined spin={isRefreshing} />}
          onClick={handleRefresh}
          loading={isRefreshing}
          type="default"
        >
          Làm mới
        </Button>
      </div>

      {/* Statistics Cards */}
      {stats && (
        <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
          <Col xs={24} sm={12} lg={8}>
            <Card>
              <Statistic
                title="Tổng doanh thu"
                value={stats.totalRevenue}
                precision={0}
                prefix={<DollarOutlined style={{ color: "#1890ff" }} />}
                suffix="VNĐ"
                styles={{ content: { color: "#1890ff" } }}
              />
              <div style={{ fontSize: 12, color: "#8c8c8c", marginTop: 8 }}>
                Từ đơn hàng đã giao
              </div>
            </Card>
          </Col>

          <Col xs={24} sm={12} lg={8}>
            <Card>
              <Statistic
                title="Tổng lợi nhuận"
                value={stats.totalProfit}
                precision={0}
                prefix={<WalletOutlined style={{ color: "#52c41a" }} />}
                suffix="VNĐ"
                styles={{ content: { color: "#52c41a" } }}
              />
              <div style={{ fontSize: 12, color: "#8c8c8c", marginTop: 8 }}>
                Giá bán - Giá vốn
              </div>
            </Card>
          </Col>

          <Col xs={24} sm={24} lg={8}>
            <Card>
              <Statistic
                title="Doanh thu tháng này"
                value={stats.monthlyRevenue}
                precision={0}
                prefix={<RiseOutlined style={{ color: "#722ed1" }} />}
                suffix="VNĐ"
                styles={{ content: { color: "#722ed1" } }}
              />
              <div
                style={{
                  fontSize: 12,
                  color: stats.growthRate >= 0 ? "#52c41a" : "#ff4d4f",
                  marginTop: 8,
                  fontWeight: 500,
                }}
              >
                {stats.growthRate >= 0 ? "↑" : "↓"}{" "}
                {Math.abs(stats.growthRate).toFixed(1)}% so với tháng trước
              </div>
            </Card>
          </Col>
        </Row>
      )}

      {/* Revenue Chart */}
      {chartData.length > 0 && (
        <Card
          title={
            <Space>
              <ShoppingCartOutlined />
              <span>Biểu đồ doanh thu</span>
            </Space>
          }
          style={{ marginBottom: 24 }}
        >
          <RevenueChart data={chartData} />
        </Card>
      )}

      {/* Top Selling Products */}
      <div style={{ marginBottom: 24 }}>
        <TopSellingProducts />
      </div>

      {/* Two Column Layout */}
      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        {/* Product Table - 2 columns on large screens */}
        <Col xs={24} lg={16}>
          <ProductTable products={products} />
        </Col>

        {/* Quick Stock Form - 1 column on large screens */}
        <Col xs={24} lg={8}>
          <QuickStockForm products={products} onStockUpdated={handleRefresh} />
        </Col>
      </Row>

      {/* Low Stock Alert */}
      {lowStockProducts.length > 0 && (
        <Alert
          message="Cảnh báo tồn kho thấp"
          description={`Có ${lowStockProducts.length} sản phẩm có số lượng tồn kho dưới 5. Vui lòng nhập hàng để tránh thiếu hàng.`}
          type="error"
          icon={<WarningOutlined />}
          showIcon
          closable
        />
      )}
    </div>
  );
}
