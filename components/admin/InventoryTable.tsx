"use client";

import {
  Button,
  Card,
  Empty,
  Image,
  Space,
  Table,
  Tag,
  Typography,
} from "antd";
import type { ColumnsType } from "antd/es/table";
import { AlertOutlined, InboxOutlined } from "@ant-design/icons";
import { formatCurrency } from "@/lib/utils";
import type { Product } from "@/types/database";

interface InventoryTableProps {
  products: Product[];
  onProductClick: (product: Product) => void;
}

export function InventoryTable({
  products,
  onProductClick,
}: InventoryTableProps) {
  const columns: ColumnsType<Product> = [
    {
      title: "Sản phẩm",
      key: "product",
      render: (_: unknown, product) => (
        <Space>
          {product.image_url ? (
            <Image
              src={product.image_url}
              alt={product.name}
              width={48}
              height={48}
              preview={false}
              style={{ objectFit: "cover", borderRadius: 8 }}
            />
          ) : (
            <div
              style={{
                width: 48,
                height: 48,
                borderRadius: 8,
                background: "#f5f5f5",
                display: "grid",
                placeItems: "center",
              }}
            >
              📦
            </div>
          )}
          <div>
            <Typography.Text strong>{product.name}</Typography.Text>
          </div>
        </Space>
      ),
    },
    {
      title: "Danh mục",
      dataIndex: "category",
      key: "category",
      width: 160,
      render: (category: string) => <Tag color="blue">{category}</Tag>,
    },
    {
      title: "Giá vốn",
      dataIndex: "cost_price",
      key: "cost_price",
      align: "right",
      width: 140,
      render: (value: number) => formatCurrency(value),
    },
    {
      title: "Giá bán",
      key: "price",
      align: "right",
      width: 180,
      render: (_: unknown, product) => {
        const profit = product.price - product.cost_price;
        const profitMargin =
          product.price > 0 ? (profit / product.price) * 100 : 0;

        return (
          <div>
            <Typography.Text strong style={{ color: "#1677ff" }}>
              {formatCurrency(product.price)}
            </Typography.Text>
            <br />
            <Typography.Text type="secondary" style={{ fontSize: 12 }}>
              Lãi: {profitMargin.toFixed(1)}%
            </Typography.Text>
          </div>
        );
      },
    },
    {
      title: "Tồn kho",
      key: "stock",
      align: "center",
      width: 150,
      render: (_: unknown, product) => {
        const isLowStock = product.stock_quantity < 10;

        return (
          <Space orientation="vertical" size={2} align="center">
            <Typography.Text
              strong
              style={{ color: isLowStock ? "#ff4d4f" : undefined }}
            >
              {product.stock_quantity}
            </Typography.Text>
            {isLowStock && (
              <Tag color="error" icon={<AlertOutlined />}>
                Cần nhập
              </Tag>
            )}
          </Space>
        );
      },
    },
    {
      title: "Hành động",
      key: "action",
      width: 140,
      align: "center",
      render: (_: unknown, product) => (
        <Button
          type="primary"
          size="small"
          icon={<InboxOutlined />}
          onClick={(event) => {
            event.stopPropagation();
            onProductClick(product);
          }}
        >
          Nhập hàng
        </Button>
      ),
    },
  ];

  return (
    <Card
      title={`Danh sách sản phẩm (${products.length})`}
      styles={{ body: { padding: 0 } }}
    >
      <Table
        rowKey="id"
        columns={columns}
        dataSource={products}
        scroll={{ x: 980 }}
        pagination={{
          pageSize: 20,
          showSizeChanger: true,
          pageSizeOptions: ["10", "20", "50", "100"],
          showTotal: (total) => `Tổng ${total} sản phẩm`,
        }}
        onRow={(record) => ({
          onClick: () => onProductClick(record),
        })}
        locale={{
          emptyText: <Empty description="Không tìm thấy sản phẩm nào" />,
        }}
      />
    </Card>
  );
}
