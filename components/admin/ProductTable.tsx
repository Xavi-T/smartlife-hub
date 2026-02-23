import { AlertOutlined } from "@ant-design/icons";
import { Card, Table, Tag, Space, Typography } from "antd";
import type { ColumnsType } from "antd/es/table";
import { formatCurrency, formatNumber } from "@/lib/utils";
import type { Product } from "@/types/database";

const { Text } = Typography;

interface ProductTableProps {
  products: Product[];
}

export function ProductTable({ products }: ProductTableProps) {
  const columns: ColumnsType<Product> = [
    {
      title: "Sản phẩm",
      dataIndex: "name",
      key: "name",
      render: (_value, product) => (
        <Space size={12} align="start">
          {product.image_url ? (
            <img
              src={product.image_url}
              alt={product.name}
              className="h-10 w-10 rounded-lg object-cover"
            />
          ) : (
            <div className="h-10 w-10 rounded-lg bg-gray-200 flex items-center justify-center">
              <span className="text-gray-400 text-xs">N/A</span>
            </div>
          )}
          <div>
            <div className="text-sm font-medium text-gray-900">
              {product.name}
            </div>
          </div>
        </Space>
      ),
    },
    {
      title: "Danh mục",
      dataIndex: "category",
      key: "category",
      render: (category: string) => <Tag color="blue">{category}</Tag>,
    },
    {
      title: "Giá bán",
      dataIndex: "price",
      key: "price",
      align: "right",
      render: (price: number) => <Text strong>{formatCurrency(price)}</Text>,
    },
    {
      title: "Giá vốn",
      dataIndex: "cost_price",
      key: "cost_price",
      align: "right",
      render: (costPrice: number) => (
        <Text type="secondary">{formatCurrency(costPrice)}</Text>
      ),
    },
    {
      title: "Tồn kho",
      dataIndex: "stock_quantity",
      key: "stock_quantity",
      align: "center",
      render: (stockQuantity: number) => {
        const isLowStock = stockQuantity < 5;
        return (
          <Space size={6}>
            {isLowStock && <AlertOutlined style={{ color: "#ff4d4f" }} />}
            <Text strong type={isLowStock ? "danger" : undefined}>
              {formatNumber(stockQuantity)}
            </Text>
          </Space>
        );
      },
    },
    {
      title: "Trạng thái",
      dataIndex: "is_active",
      key: "is_active",
      align: "center",
      render: (isActive: boolean) => (
        <Tag color={isActive ? "green" : "default"}>
          {isActive ? "Hoạt động" : "Ngừng bán"}
        </Tag>
      ),
    },
  ];

  return (
    <Card title="Danh sách sản phẩm">
      <Table
        rowKey="id"
        dataSource={products}
        columns={columns}
        pagination={false}
        scroll={{ x: 900 }}
        locale={{ emptyText: "Không có sản phẩm nào" }}
        rowClassName={(record) =>
          record.stock_quantity < 5 ? "bg-red-50 hover:!bg-red-100" : ""
        }
      />
    </Card>
  );
}
