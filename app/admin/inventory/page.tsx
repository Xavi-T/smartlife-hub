"use client";

import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import {
  Alert,
  Button,
  Card,
  Col,
  Input,
  Row,
  Select,
  Space,
  Spin,
  Statistic,
  Typography,
} from "antd";
import {
  AlertOutlined,
  AppstoreAddOutlined,
  DatabaseOutlined,
  PlusOutlined,
  ReloadOutlined,
  SearchOutlined,
} from "@ant-design/icons";
import { InventoryTable } from "@/components/admin/InventoryTable";
import { StockInboundModal } from "@/components/admin/StockInboundModal";
import { formatCurrency } from "@/lib/utils";
import type { Product } from "@/types/database";

export default function InventoryPage() {
  const router = useRouter();
  const [products, setProducts] = useState<Product[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [isInboundModalOpen, setIsInboundModalOpen] = useState(false);

  // Fetch products
  const fetchProducts = async () => {
    try {
      const res = await fetch("/api/products");
      if (!res.ok) throw new Error("Failed to fetch products");
      const data = await res.json();
      setProducts(data);
    } catch (error) {
      console.error("Error fetching products:", error);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    fetchProducts();
  }, []);

  // Get unique categories
  const categories = useMemo(() => {
    const cats = new Set(products.map((p) => p.category));
    return Array.from(cats).sort();
  }, [products]);

  // Filter products
  const filteredProducts = useMemo(() => {
    return products.filter((product) => {
      const matchesSearch = product.name
        .toLowerCase()
        .includes(searchQuery.toLowerCase());
      const matchesCategory =
        selectedCategory === "all" || product.category === selectedCategory;
      return matchesSearch && matchesCategory;
    });
  }, [products, searchQuery, selectedCategory]);

  // Stats
  const stats = useMemo(() => {
    const lowStockCount = products.filter(
      (p) => p.stock_quantity < 10 && p.is_active,
    ).length;
    const totalValue = products.reduce(
      (sum, p) => sum + p.cost_price * p.stock_quantity,
      0,
    );
    const totalItems = products.reduce((sum, p) => sum + p.stock_quantity, 0);

    return { lowStockCount, totalValue, totalItems };
  }, [products]);

  const handleRefresh = () => {
    setIsRefreshing(true);
    fetchProducts();
  };

  const handleProductClick = (product: Product) => {
    setSelectedProduct(product);
    setIsInboundModalOpen(true);
  };

  const handleInboundSuccess = () => {
    fetchProducts();
  };

  if (isLoading) {
    return (
      <div style={{ minHeight: "60vh", display: "grid", placeItems: "center" }}>
        <Space orientation="vertical" align="center">
          <Spin size="large" />
          <Typography.Text type="secondary">
            Đang tải dữ liệu...
          </Typography.Text>
        </Space>
      </div>
    );
  }

  return (
    <div style={{ minHeight: "100vh", background: "#f5f5f5" }}>
      <Space
        orientation="vertical"
        size={16}
        style={{ width: "100%", padding: 24 }}
      >
        <Card>
          <Space
            style={{ width: "100%", justifyContent: "space-between" }}
            align="start"
            wrap
          >
            <Space>
              <Button
                icon={<PlusOutlined />}
                onClick={() => router.push("/admin/products")}
              >
                Thêm sản phẩm
              </Button>
              <Button
                type="primary"
                icon={<ReloadOutlined spin={isRefreshing} />}
                onClick={handleRefresh}
                loading={isRefreshing}
              >
                Làm mới
              </Button>
            </Space>
          </Space>
        </Card>

        <Row gutter={[16, 16]}>
          <Col xs={24} md={8}>
            <Card>
              <Statistic
                title="Tổng sản phẩm"
                value={products.length}
                prefix={<AppstoreAddOutlined />}
              />
            </Card>
          </Col>
          <Col xs={24} md={8}>
            <Card>
              <Statistic
                title="Tổng số lượng tồn"
                value={stats.totalItems}
                formatter={(value) =>
                  Number(value || 0).toLocaleString("vi-VN")
                }
                prefix={<DatabaseOutlined />}
              />
            </Card>
          </Col>
          <Col xs={24} md={8}>
            <Card>
              <Statistic
                title="Giá trị tồn kho"
                value={stats.totalValue}
                formatter={(value) => formatCurrency(Number(value || 0))}
                style={{ color: "#1677ff" }}
              />
            </Card>
          </Col>
        </Row>

        <Card>
          <Space
            wrap
            style={{ width: "100%", justifyContent: "space-between" }}
          >
            <Space wrap>
              <Input
                allowClear
                placeholder="Tìm kiếm sản phẩm theo tên..."
                prefix={<SearchOutlined />}
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                style={{ minWidth: 280 }}
              />
              <Select
                value={selectedCategory}
                onChange={setSelectedCategory}
                style={{ minWidth: 220 }}
                options={[
                  { value: "all", label: "Tất cả danh mục" },
                  ...categories.map((category) => ({
                    value: category,
                    label: category,
                  })),
                ]}
              />
            </Space>
            <Typography.Text type="secondary">
              {filteredProducts.length} sản phẩm
            </Typography.Text>
          </Space>
        </Card>

        {stats.lowStockCount > 0 && (
          <Alert
            showIcon
            type="warning"
            icon={<AlertOutlined />}
            title="Cảnh báo tồn kho thấp"
            description={`Có ${stats.lowStockCount} sản phẩm có tồn kho dưới 10. Click vào sản phẩm để nhập hàng nhanh.`}
          />
        )}

        <InventoryTable
          products={filteredProducts}
          onProductClick={handleProductClick}
        />
      </Space>

      {/* Stock Inbound Modal */}
      <StockInboundModal
        isOpen={isInboundModalOpen}
        onClose={() => setIsInboundModalOpen(false)}
        product={selectedProduct}
        onSuccess={handleInboundSuccess}
      />
    </div>
  );
}
