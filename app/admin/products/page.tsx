"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  Button,
  Table,
  Image,
  Tag,
  Space,
  Popconfirm,
  message,
  Card,
  Input,
  Select,
  Row,
  Col,
  Statistic,
} from "antd";
import {
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  ReloadOutlined,
  SearchOutlined,
  PictureOutlined,
  InboxOutlined,
  AlertOutlined,
  DollarOutlined,
  AppstoreOutlined,
} from "@ant-design/icons";
import { calculateDiscountedPrice, formatCurrency } from "@/lib/utils";
import type { Product } from "@/types/database";

function getProductCategoryNames(product: Product): string[] {
  if (product.categories && product.categories.length > 0) {
    return product.categories.map((item) => item.name);
  }
  return product.category ? [product.category] : [];
}

function stripHtmlTags(value: string): string {
  return value
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export default function ProductsPage() {
  const router = useRouter();
  const [messageApi, contextHolder] = message.useMessage();
  const [products, setProducts] = useState<Product[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("active");

  // Fetch products
  const fetchProducts = useCallback(async () => {
    try {
      const res = await fetch(`/api/products?activeOnly=false&t=${Date.now()}`, {
        cache: "no-store",
      });
      if (!res.ok) throw new Error("Failed to fetch products");
      const data = await res.json();
      setProducts(data);
    } catch (error) {
      console.error("Error fetching products:", error);
      messageApi.error("Không thể tải danh sách sản phẩm");
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [messageApi]);

  useEffect(() => {
    fetchProducts();
  }, [fetchProducts]);

  // Get unique categories
  const categories = useMemo(() => {
    const cats = new Set(products.flatMap((p) => getProductCategoryNames(p)));
    return Array.from(cats).sort();
  }, [products]);

  // Filter products
  const filteredProducts = useMemo(() => {
    return products.filter((product) => {
      const matchesSearch =
        product.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        product.description?.toLowerCase().includes(searchQuery.toLowerCase());

      const matchesCategory =
        selectedCategory === "all" ||
        getProductCategoryNames(product).includes(selectedCategory);

      const matchesStatus =
        statusFilter === "all" ||
        (statusFilter === "active" && product.is_active) ||
        (statusFilter === "inactive" && !product.is_active) ||
        (statusFilter === "low-stock" &&
          product.stock_quantity < 10 &&
          product.is_active);

      return matchesSearch && matchesCategory && matchesStatus;
    });
  }, [products, searchQuery, selectedCategory, statusFilter]);

  // Stats
  const stats = useMemo(() => {
    const activeCount = products.filter((p) => p.is_active).length;
    const totalValue = products.reduce(
      (sum, p) => sum + p.price * p.stock_quantity,
      0,
    );
    const lowStockCount = products.filter(
      (p) => p.stock_quantity < 10 && p.is_active,
    ).length;
    const categoryCount = new Set(products.map((p) => p.category)).size;

    return { activeCount, totalValue, lowStockCount, categoryCount };
  }, [products]);

  const handleRefresh = () => {
    setIsRefreshing(true);
    fetchProducts();
  };

  const handleAdd = () => {
    router.push("/admin/products/new");
  };

  const handleEdit = (product: Product) => {
    router.push(`/admin/products/${product.id}/edit`);
  };

  const handleDelete = async (product: Product) => {
    try {
      const res = await fetch(`/api/products?id=${product.id}`, {
        method: "DELETE",
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error);
      }

      messageApi.success(`Đã xóa sản phẩm "${product.name}"`);
      fetchProducts();
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : "Không thể xóa sản phẩm";
      messageApi.error(errorMessage);
    }
  };

  const columns = [
    {
      title: "Sản phẩm",
      dataIndex: "name",
      key: "name",
      width: 300,
      render: (_: unknown, record: Product) => (
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          {record.image_url ? (
            <Image
              src={record.image_url}
              alt={record.name}
              width={48}
              height={48}
              style={{ objectFit: "cover", borderRadius: 8 }}
              preview
            />
          ) : (
            <div
              style={{
                width: 48,
                height: 48,
                backgroundColor: "#f0f0f0",
                borderRadius: 8,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <PictureOutlined style={{ fontSize: 20, color: "#bfbfbf" }} />
            </div>
          )}
          <div>
            <div style={{ fontWeight: 600, marginBottom: 4 }}>
              {record.name}
            </div>
            {record.description && (
              <div
                style={{
                  fontSize: 12,
                  color: "#8c8c8c",
                  maxWidth: 200,
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {stripHtmlTags(record.description)}
              </div>
            )}
          </div>
        </div>
      ),
    },
    {
      title: "Danh mục",
      dataIndex: "category",
      key: "category",
      width: 220,
      render: (_: string, record: Product) => (
        <Space size={4} wrap>
          {getProductCategoryNames(record).map((categoryName) => (
            <Tag key={`${record.id}-${categoryName}`} color="blue">
              {categoryName}
            </Tag>
          ))}
        </Space>
      ),
    },
    {
      title: "Giá vốn",
      dataIndex: "cost_price",
      key: "cost_price",
      width: 130,
      align: "right" as const,
      render: (value: number) => (
        <span style={{ fontWeight: 500 }}>{formatCurrency(value)}</span>
      ),
    },
    {
      title: "Giảm giá",
      dataIndex: "discount_percent",
      key: "discount_percent",
      width: 100,
      align: "center" as const,
      render: (value: number | null) => {
        const discount = value || 0;
        return discount > 0 ? (
          <Tag color="red">-{discount}%</Tag>
        ) : (
          <Tag>0%</Tag>
        );
      },
    },
    {
      title: "Giá bán",
      dataIndex: "price",
      key: "price",
      width: 130,
      align: "right" as const,
      render: (value: number, record: Product) => {
        const finalPrice = calculateDiscountedPrice(
          value,
          record.discount_percent,
        );
        const profit = finalPrice - record.cost_price;
        const margin =
          finalPrice > 0 ? ((profit / finalPrice) * 100).toFixed(0) : "0";
        return (
          <div>
            <div style={{ fontWeight: 600, color: "#52c41a" }}>
              {formatCurrency(finalPrice)}
            </div>
            {(record.discount_percent || 0) > 0 && (
              <div
                style={{
                  fontSize: 11,
                  color: "#8c8c8c",
                  textDecoration: "line-through",
                }}
              >
                {formatCurrency(value)}
              </div>
            )}
            <div style={{ fontSize: 11, color: "#8c8c8c" }}>Lãi: {margin}%</div>
          </div>
        );
      },
    },
    {
      title: "Tồn kho",
      dataIndex: "stock_quantity",
      key: "stock_quantity",
      width: 100,
      align: "center" as const,
      render: (value: number, record: Product) => {
        const isLowStock = value < 10 && record.is_active;
        return (
          <Tag color={isLowStock ? "red" : value === 0 ? "default" : "green"}>
            {isLowStock && <AlertOutlined style={{ marginRight: 4 }} />}
            {value}
          </Tag>
        );
      },
    },
    {
      title: "Trạng thái",
      dataIndex: "is_active",
      key: "is_active",
      width: 100,
      align: "center" as const,
      render: (value: boolean) => (
        <Tag color={value ? "success" : "default"}>
          {value ? "Hiển thị" : "Ẩn"}
        </Tag>
      ),
    },
    {
      title: "Hành động",
      key: "actions",
      width: 240,
      align: "center" as const,
      render: (_: unknown, record: Product) => (
        <Space size="small">
          <Button
            type="link"
            size="small"
            icon={<EditOutlined />}
            onClick={() => handleEdit(record)}
          />
          <Popconfirm
            title="Xác nhận xóa"
            description={`Bạn có chắc muốn xóa "${record.name}"?`}
            onConfirm={() => handleDelete(record)}
            okText="Xóa"
            cancelText="Hủy"
            okButtonProps={{ danger: true }}
          >
            <Button type="link" size="small" danger icon={<DeleteOutlined />} />
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <div style={{ background: "#f5f5f5", minHeight: "100vh", padding: 24 }}>
      {contextHolder}

      {/* Header */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 24,
        }}
      >
        <div>
          <h1 style={{ fontSize: 28, fontWeight: 700, margin: 0 }}>
            Quản lý Sản phẩm
          </h1>
          <p style={{ color: "#8c8c8c", margin: "4px 0 0 0" }}>
            Thêm, sửa, xóa sản phẩm và quản lý thông tin
          </p>
        </div>
        <Space>
          <Button
            icon={<ReloadOutlined spin={isRefreshing} />}
            onClick={handleRefresh}
            loading={isRefreshing}
          >
            Làm mới
          </Button>
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={handleAdd}
            size="large"
          >
            Thêm sản phẩm
          </Button>
        </Space>
      </div>

      {/* Stats Cards */}
      <Row gutter={16} style={{ marginBottom: 24 }}>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic
              title="Tổng sản phẩm"
              value={stats.activeCount}
              prefix={<AppstoreOutlined style={{ color: "#1890ff" }} />}
              suffix={`/ ${products.length}`}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic
              title="Giá trị tồn kho"
              value={stats.totalValue}
              precision={0}
              prefix={<DollarOutlined style={{ color: "#52c41a" }} />}
              suffix="VNĐ"
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic
              title="Sắp hết hàng"
              value={stats.lowStockCount}
              prefix={<AlertOutlined style={{ color: "#ff4d4f" }} />}
              style={{
                color: stats.lowStockCount > 0 ? "#ff4d4f" : undefined,
              }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic
              title="Danh mục"
              value={stats.categoryCount}
              prefix={<InboxOutlined style={{ color: "#722ed1" }} />}
            />
          </Card>
        </Col>
      </Row>

      {/* Filters */}
      <Card style={{ marginBottom: 16 }}>
        <Row gutter={16}>
          <Col xs={24} sm={24} md={10}>
            <Input
              placeholder="Tìm kiếm sản phẩm..."
              prefix={<SearchOutlined />}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              allowClear
            />
          </Col>
          <Col xs={12} sm={12} md={7}>
            <Select
              style={{ width: "100%" }}
              placeholder="Danh mục"
              value={selectedCategory}
              onChange={setSelectedCategory}
              options={[
                { label: "Tất cả danh mục", value: "all" },
                ...categories.map((cat) => ({ label: cat, value: cat })),
              ]}
            />
          </Col>
          <Col xs={12} sm={12} md={7}>
            <Select
              style={{ width: "100%" }}
              placeholder="Trạng thái"
              value={statusFilter}
              onChange={setStatusFilter}
              options={[
                { label: "Tất cả", value: "all" },
                { label: "Đang hiển thị", value: "active" },
                { label: "Đã ẩn", value: "inactive" },
                { label: "Sắp hết hàng", value: "low-stock" },
              ]}
            />
          </Col>
        </Row>
      </Card>

      {/* Table */}
      <Card>
        <Table
          columns={columns}
          dataSource={filteredProducts}
          rowKey="id"
          loading={isLoading}
          pagination={{
            pageSize: 20,
            showSizeChanger: true,
            showTotal: (total) => `Tổng ${total} sản phẩm`,
          }}
          scroll={{ x: 1200 }}
        />
      </Card>
    </div>
  );
}
