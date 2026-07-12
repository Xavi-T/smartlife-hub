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

function normalizeMoney(value: unknown): number {
  return Math.max(0, Math.round(Number(value || 0)));
}

function parseVietnameseMoney(value: string): number {
  return normalizeMoney(value.replace(/[^\d]/g, ""));
}

function formatSignedCurrency(amount: number): string {
  if (amount <= 0) return formatCurrency(0);
  return `-${formatCurrency(amount)}`;
}

function allocateDiscountAcrossRows(
  discountAmount: number,
  rowTotals: number[],
): number[] {
  const totalBeforeDiscount = rowTotals.reduce((sum, value) => sum + value, 0);
  const totalDiscount = Math.min(
    normalizeMoney(discountAmount),
    totalBeforeDiscount,
  );

  if (totalDiscount <= 0 || totalBeforeDiscount <= 0) {
    return rowTotals.map(() => 0);
  }

  const allocations = rowTotals.map((rowTotal) => {
    const exactShare = (totalDiscount * rowTotal) / totalBeforeDiscount;
    const amount = Math.min(rowTotal, Math.floor(exactShare));

    return {
      rowTotal,
      amount,
      remainder: exactShare - amount,
    };
  });

  let remaining =
    totalDiscount - allocations.reduce((sum, item) => sum + item.amount, 0);

  while (remaining > 0) {
    let changed = false;
    const sorted = [...allocations].sort((first, second) => {
      if (second.remainder !== first.remainder) {
        return second.remainder - first.remainder;
      }

      return second.rowTotal - first.rowTotal;
    });

    for (const item of sorted) {
      if (remaining <= 0) break;
      if (item.amount >= item.rowTotal) continue;

      item.amount += 1;
      remaining -= 1;
      changed = true;
    }

    if (!changed) break;
  }

  return allocations.map((item) => item.amount);
}

function parseDiscountInfo(notes: string | null, totalAmount: number) {
  const rawNotes = notes || "";
  const lines = rawNotes
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  const explicitAmountLine = lines.find((line) => /^số tiền giảm:/i.test(line));
  const explicitAmount = explicitAmountLine
    ? parseVietnameseMoney(explicitAmountLine)
    : 0;

  const labelLine = lines.find((line) => /^giảm giá/i.test(line)) || null;
  const percentMatch = rawNotes.match(
    /giảm giá theo tổng đơn:\s*([\d.,]+)\s*%/i,
  );
  const percent = percentMatch?.[1]
    ? Math.min(99.99, Math.max(0, Number(percentMatch[1].replace(",", "."))))
    : 0;

  const discountAmount =
    explicitAmount > 0
      ? explicitAmount
      : percent > 0 && totalAmount > 0
        ? Math.max(
            0,
            Math.round(totalAmount / (1 - percent / 100)) - totalAmount,
          )
        : 0;

  const grossAmount = discountAmount > 0 ? totalAmount + discountAmount : 0;

  return {
    label: labelLine,
    discountAmount,
    grossAmount,
    hasDiscount: Boolean(labelLine) || explicitAmount > 0 || percent > 0,
  };
}

function getDisplayNotes(notes: string | null): string | null {
  const lines = (notes || "")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .filter(
      (line) =>
        !/^hình thức đặt hàng:/i.test(line) &&
        !/^thanh toán:/i.test(line) &&
        !/^giảm giá theo/i.test(line) &&
        !/^số tiền giảm:/i.test(line),
    );

  return lines.length > 0 ? lines.join("\n") : null;
}

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

interface OrderItemRow extends OrderItem {
  discountAmount: number;
  paymentAmount: number;
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

  const columns: ColumnsType<OrderItemRow> = [
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
      title: "Giảm giá",
      dataIndex: "subtotal",
      key: "discount",
      width: 160,
      align: "right",
      render: (_, item: OrderItemRow) => (
        <Typography.Text strong style={{ color: "#fa8c16" }}>
          {formatSignedCurrency(item.discountAmount || 0)}
        </Typography.Text>
      ),
    },
    {
      title: "Thanh toán",
      dataIndex: "paymentAmount",
      key: "paymentAmount",
      width: 160,
      align: "right",
      render: (_, item: OrderItemRow) => (
        <Typography.Text strong style={{ color: "#1677ff" }}>
          {formatCurrency(item.paymentAmount || item.subtotal)}
        </Typography.Text>
      ),
    },
  ];

  if (!order) return null;

  const discountInfo = parseDiscountInfo(order.notes, order.total_amount);
  const displayNotes = getDisplayNotes(order.notes);
  const rowDiscounts = allocateDiscountAcrossRows(
    discountInfo.discountAmount,
    order.order_items.map((item) => item.subtotal),
  );
  const tableData: OrderItemRow[] = order.order_items.map((item, index) => ({
    ...item,
    discountAmount: rowDiscounts[index] || 0,
    paymentAmount: Math.max(0, item.subtotal - (rowDiscounts[index] || 0)),
  }));

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
                  <Tag
                    color={order.order_type === "counter" ? "purple" : "blue"}
                  >
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
                <Descriptions.Item label="Thanh toán">
                  <Typography.Text strong style={{ color: "#1677ff" }}>
                    {formatCurrency(order.total_amount)}
                  </Typography.Text>
                </Descriptions.Item>
              </Descriptions>
            </Card>
          </Col>
        </Row>

        {discountInfo.hasDiscount && (
          <Card title="Chiết khấu" size="small">
            <Descriptions column={1} size="small">
              <Descriptions.Item label="Hình thức">
                {discountInfo.label || "Giảm giá"}
              </Descriptions.Item>
              <Descriptions.Item label="Số tiền giảm">
                <Typography.Text strong style={{ color: "#fa8c16" }}>
                  {discountInfo.discountAmount > 0
                    ? `-${formatCurrency(discountInfo.discountAmount)}`
                    : "Chưa xác định"}
                </Typography.Text>
              </Descriptions.Item>
              <Descriptions.Item label="Tổng trước giảm">
                <Typography.Text strong>
                  {discountInfo.grossAmount > 0
                    ? formatCurrency(discountInfo.grossAmount)
                    : "Chưa xác định"}
                </Typography.Text>
              </Descriptions.Item>
              <Descriptions.Item label="Sau giảm">
                <Typography.Text strong style={{ color: "#1677ff" }}>
                  {formatCurrency(order.total_amount)}
                </Typography.Text>
              </Descriptions.Item>
            </Descriptions>
          </Card>
        )}

        {displayNotes && (
          <Alert
            type="warning"
            showIcon
            title="Ghi chú"
            description={displayNotes}
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
            dataSource={tableData}
            pagination={false}
            summary={() => (
              <>
                <Table.Summary.Row>
                  <Table.Summary.Cell index={0} colSpan={4}>
                    <Typography.Text strong>Tạm tính</Typography.Text>
                  </Table.Summary.Cell>
                  <Table.Summary.Cell index={1} align="right">
                    <Typography.Text strong>
                      {formatCurrency(
                        discountInfo.grossAmount || order.total_amount,
                      )}
                    </Typography.Text>
                  </Table.Summary.Cell>
                </Table.Summary.Row>
                {discountInfo.discountAmount > 0 && (
                  <Table.Summary.Row>
                    <Table.Summary.Cell index={0} colSpan={4}>
                      <Typography.Text strong>
                        {discountInfo.label || "Giảm giá"}
                      </Typography.Text>
                    </Table.Summary.Cell>
                    <Table.Summary.Cell index={1} align="right">
                      <Typography.Text strong style={{ color: "#fa8c16" }}>
                        {formatSignedCurrency(discountInfo.discountAmount)}
                      </Typography.Text>
                    </Table.Summary.Cell>
                  </Table.Summary.Row>
                )}
                <Table.Summary.Row>
                  <Table.Summary.Cell index={0} colSpan={4}>
                    <Typography.Text strong>Thanh toán</Typography.Text>
                  </Table.Summary.Cell>
                  <Table.Summary.Cell index={1} align="right">
                    <Typography.Text strong style={{ color: "#1677ff" }}>
                      {formatCurrency(order.total_amount)}
                    </Typography.Text>
                  </Table.Summary.Cell>
                </Table.Summary.Row>
              </>
            )}
          />
        </Card>
      </Space>
    </Modal>
  );
}
