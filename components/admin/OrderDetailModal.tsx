"use client";

import {
  Alert,
  Card,
  Col,
  Descriptions,
  Image,
  Modal,
  Row,
  Space,
  Table,
  Tag,
  Timeline,
  Typography,
} from "antd";
import type { ColumnsType } from "antd/es/table";
import {
  getDisplayCustomerName,
  getDisplayCustomerPhone,
} from "@/lib/customerIdentity";
import { formatCurrency } from "@/lib/utils";

interface OrderItem {
  id: string;
  quantity: number;
  unit_price: number;
  subtotal: number;
  products: {
    id: string;
    name: string;
    image_url: string | null;
    category: string;
  };
}

interface Order {
  id: string;
  customer_name: string;
  customer_phone: string;
  customer_address: string;
  total_amount: number;
  status: string;
  order_type?: "online" | "counter";
  notes: string | null;
  created_at: string;
  order_items: OrderItem[];
  order_status_history?: Array<{
    id: string;
    status: string;
    note: string | null;
    created_by: string | null;
    created_at: string;
  }>;
}

interface OrderDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  order: Order | null;
}

export function OrderDetailModal({
  isOpen,
  onClose,
  order,
}: OrderDetailModalProps) {
  const statusColors = {
    pending: "gold",
    confirmed: "blue",
    shipping: "processing",
    completed: "success",
    cancelled: "error",
  } as const;

  const statusLabels = {
    pending: "Chờ xác nhận",
    confirmed: "Đã xác nhận",
    shipping: "Đang vận chuyển",
    completed: "Đã hoàn thành",
    cancelled: "Đã hủy",
  } as const;

  const columns: ColumnsType<OrderItem> = [
    {
      title: "Sản phẩm",
      dataIndex: "products",
      key: "products",
      render: (product: OrderItem["products"]) => (
        <Space>
          {product.image_url ? (
            <Image
              src={product.image_url}
              alt={product.name}
              width={48}
              height={48}
              style={{ objectFit: "cover", borderRadius: 8 }}
              preview={false}
            />
          ) : (
            <div
              style={{
                width: 48,
                height: 48,
                borderRadius: 8,
                background: "#f5f5f5",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              📦
            </div>
          )}
          <div>
            <Typography.Text strong>{product.name}</Typography.Text>
            <br />
            <Typography.Text type="secondary" style={{ fontSize: 12 }}>
              {product.category}
            </Typography.Text>
          </div>
        </Space>
      ),
    },
    {
      title: "Số lượng",
      dataIndex: "quantity",
      key: "quantity",
      width: 100,
      align: "center",
    },
    {
      title: "Đơn giá",
      dataIndex: "unit_price",
      key: "unit_price",
      width: 160,
      align: "right",
      render: (value: number) => formatCurrency(value),
    },
    {
      title: "Thành tiền",
      dataIndex: "subtotal",
      key: "subtotal",
      width: 160,
      align: "right",
      render: (value: number) => (
        <Typography.Text strong style={{ color: "#1677ff" }}>
          {formatCurrency(value)}
        </Typography.Text>
      ),
    },
  ];

  if (!order) return null;

  return (
    <Modal
      title={
        <div>
          <Typography.Title level={4} style={{ margin: 0 }}>
            Chi tiết đơn hàng
          </Typography.Title>
          <Typography.Text type="secondary">
            #{order.id.slice(0, 8).toUpperCase()}
          </Typography.Text>
        </div>
      }
      open={isOpen}
      onCancel={onClose}
      footer={null}
      width={960}
      destroyOnHidden
    >
      <Space orientation="vertical" size={16} style={{ width: "100%" }}>
        <Row gutter={16}>
          <Col xs={24} md={12}>
            <Card title="Thông tin khách hàng" size="small">
              <Descriptions column={1} size="small">
                <Descriptions.Item label="Tên khách hàng">
                  {getDisplayCustomerName({
                    name: order.customer_name,
                    phone: order.customer_phone,
                  })}
                </Descriptions.Item>
                <Descriptions.Item label="Số điện thoại">
                  {getDisplayCustomerPhone(order.customer_phone) ||
                    "Không có SĐT"}
                </Descriptions.Item>
                <Descriptions.Item label="Địa chỉ giao hàng">
                  {order.customer_address}
                </Descriptions.Item>
              </Descriptions>
            </Card>
          </Col>
          <Col xs={24} md={12}>
            <Card title="Thông tin đơn hàng" size="small">
              <Descriptions column={1} size="small">
                <Descriptions.Item label="Ngày đặt hàng">
                  {new Date(order.created_at).toLocaleString("vi-VN")}
                </Descriptions.Item>
                <Descriptions.Item label="Loại đơn">
                  <Tag color={order.order_type === "counter" ? "purple" : "blue"}>
                    {order.order_type === "counter"
                      ? "Mua tại quầy"
                      : "Khách online"}
                  </Tag>
                </Descriptions.Item>
                <Descriptions.Item label="Trạng thái">
                  <Tag
                    color={
                      statusColors[order.status as keyof typeof statusColors]
                    }
                  >
                    {statusLabels[order.status as keyof typeof statusLabels]}
                  </Tag>
                </Descriptions.Item>
                <Descriptions.Item label="Tổng tiền">
                  <Typography.Text strong style={{ color: "#1677ff" }}>
                    {formatCurrency(order.total_amount)}
                  </Typography.Text>
                </Descriptions.Item>
              </Descriptions>
            </Card>
          </Col>
        </Row>

        {order.notes && (
          <Alert
            type="warning"
            showIcon
            title="Ghi chú"
            description={order.notes}
          />
        )}

        {order.order_status_history &&
          order.order_status_history.length > 0 && (
            <Card title="Lịch sử trạng thái" size="small">
              <Timeline
                items={[...order.order_status_history]
                  .sort(
                    (first, second) =>
                      new Date(second.created_at).getTime() -
                      new Date(first.created_at).getTime(),
                  )
                  .map((history) => ({
                    color:
                      history.status === "cancelled"
                        ? "red"
                        : history.status === "completed"
                          ? "green"
                          : "blue",
                    children: (
                      <div>
                        <Typography.Text strong>
                          {statusLabels[
                            history.status as keyof typeof statusLabels
                          ] || history.status}
                        </Typography.Text>
                        <Typography.Text
                          type="secondary"
                          style={{ display: "block", fontSize: 12 }}
                        >
                          {new Date(history.created_at).toLocaleString("vi-VN")}
                        </Typography.Text>
                        {history.note && (
                          <Typography.Paragraph style={{ marginBottom: 0 }}>
                            {history.note}
                          </Typography.Paragraph>
                        )}
                      </div>
                    ),
                  }))}
              />
            </Card>
          )}

        <Card
          title={`Danh sách sản phẩm (${order.order_items.length})`}
          size="small"
        >
          <Table
            rowKey="id"
            columns={columns}
            dataSource={order.order_items}
            pagination={false}
            summary={() => (
              <Table.Summary.Row>
                <Table.Summary.Cell index={0} colSpan={3}>
                  <Typography.Text strong>Tổng cộng</Typography.Text>
                </Table.Summary.Cell>
                <Table.Summary.Cell index={1} align="right">
                  <Typography.Text strong style={{ color: "#1677ff" }}>
                    {formatCurrency(order.total_amount)}
                  </Typography.Text>
                </Table.Summary.Cell>
              </Table.Summary.Row>
            )}
          />
        </Card>
      </Space>
    </Modal>
  );
}
