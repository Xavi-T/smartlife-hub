"use client";

import { useState, useEffect, useMemo } from "react";
import {
  Card,
  Table,
  Tag,
  Button,
  Space,
  Input,
  Statistic,
  Row,
  Col,
} from "antd";
import type { ColumnsType } from "antd/es/table";
import {
  ShoppingOutlined,
  DollarOutlined,
  ClockCircleOutlined,
  RocketOutlined,
  EyeOutlined,
  EditOutlined,
  SearchOutlined,
  ReloadOutlined,
} from "@ant-design/icons";
import { OrderDetailModal } from "@/components/admin/OrderDetailModal";
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
  status: "pending" | "processing" | "delivered" | "cancelled";
  checkout_method?: "cod" | "bank_transfer";
  payment_method?: "cod" | "bank_transfer";
  payment_confirmed?: boolean;
  payment_confirmed_at?: string | null;
  notes: string | null;
  created_at: string;
  order_items: OrderItem[];
}

export default function OrdersPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  const fetchOrders = async () => {
    try {
      const res = await fetch("/api/admin/orders");
      if (!res.ok) throw new Error("Failed to fetch orders");
      const data = await res.json();
      setOrders(data);
    } catch (error) {
      console.error("Error fetching orders:", error);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    fetchOrders();
  }, []);

  const handleRefresh = () => {
    setIsRefreshing(true);
    fetchOrders();
  };

  const handleOrderClick = (order: Order) => {
    setSelectedOrder(order);
    setIsDetailModalOpen(true);
  };

  const handleConfirmPayment = async (orderId: string, confirmed: boolean) => {
    try {
      const response = await fetch("/api/admin/orders/confirm-payment", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId, paymentConfirmed: confirmed }),
      });

      if (!response.ok) {
        const result = await response.json();
        throw new Error(result.error || "Không thể cập nhật thanh toán");
      }

      await fetchOrders();
    } catch (error) {
      console.error("Error confirming payment:", error);
    }
  };

  // Stats
  const stats = useMemo(() => {
    const totalOrders = orders.length;
    const totalRevenue = orders
      .filter((o) => o.status === "delivered")
      .reduce((sum, o) => sum + o.total_amount, 0);

    const pending = orders.filter((o) => o.status === "pending").length;
    const processing = orders.filter((o) => o.status === "processing").length;
    const delivered = orders.filter((o) => o.status === "delivered").length;
    const cancelled = orders.filter((o) => o.status === "cancelled").length;

    return {
      totalOrders,
      totalRevenue,
      pending,
      processing,
      delivered,
      cancelled,
    };
  }, [orders]);

  // Status tag config
  const getStatusTag = (status: Order["status"]) => {
    const statusConfig = {
      pending: { color: "gold", text: "Chờ xác nhận" },
      processing: { color: "processing", text: "Đang giao" },
      delivered: { color: "success", text: "Đã giao" },
      cancelled: { color: "error", text: "Đã hủy" },
    };
    const config = statusConfig[status];
    return <Tag color={config.color}>{config.text}</Tag>;
  };

  // Table columns
  const columns: ColumnsType<Order> = [
    {
      title: "Mã đơn",
      dataIndex: "id",
      key: "id",
      width: 120,
      fixed: "left",
      render: (id: string) => (
        <span style={{ fontFamily: "monospace", fontSize: 12 }}>
          #{id.slice(0, 8)}
        </span>
      ),
    },
    {
      title: "Khách hàng",
      dataIndex: "customer_name",
      key: "customer_name",
      width: 200,
      filterDropdown: ({
        setSelectedKeys,
        selectedKeys,
        confirm,
        clearFilters,
      }) => (
        <div style={{ padding: 8 }}>
          <Input
            placeholder="Tìm tên khách hàng"
            value={selectedKeys[0]}
            onChange={(e) =>
              setSelectedKeys(e.target.value ? [e.target.value] : [])
            }
            onPressEnter={() => confirm()}
            style={{ marginBottom: 8, display: "block" }}
          />
          <Space>
            <Button
              type="primary"
              onClick={() => confirm()}
              icon={<SearchOutlined />}
              size="small"
              style={{ width: 90 }}
            >
              Tìm
            </Button>
            <Button
              onClick={() => clearFilters?.()}
              size="small"
              style={{ width: 90 }}
            >
              Reset
            </Button>
          </Space>
        </div>
      ),
      onFilter: (value, record) =>
        record.customer_name
          .toLowerCase()
          .includes((value as string).toLowerCase()),
      render: (name: string, record: Order) => (
        <div>
          <div style={{ fontWeight: 500 }}>{name}</div>
          <div style={{ fontSize: 12, color: "#8c8c8c" }}>
            {record.customer_phone}
          </div>
        </div>
      ),
    },
    {
      title: "Trạng thái",
      dataIndex: "status",
      key: "status",
      width: 150,
      filters: [
        { text: "Chờ xác nhận", value: "pending" },
        { text: "Đang giao", value: "processing" },
        { text: "Đã giao", value: "delivered" },
        { text: "Đã hủy", value: "cancelled" },
      ],
      onFilter: (value, record) => record.status === value,
      render: (status: Order["status"]) => getStatusTag(status),
    },
    {
      title: "Thanh toán",
      key: "payment",
      width: 220,
      render: (_: unknown, record: Order) => {
        const isBankTransfer = record.payment_method === "bank_transfer";

        if (!isBankTransfer) {
          return <Tag color="default">COD</Tag>;
        }

        if (record.payment_confirmed) {
          return (
            <Space orientation="vertical" size={4}>
              <Tag color="green">Đã xác nhận</Tag>
              <Button
                size="small"
                type="link"
                danger
                onClick={() => handleConfirmPayment(record.id, false)}
                style={{ padding: 0 }}
              >
                Bỏ xác nhận
              </Button>
            </Space>
          );
        }

        return (
          <Space orientation="vertical" size={4}>
            <Tag color="orange">Chờ xác nhận CK</Tag>
            <Button
              size="small"
              type="primary"
              onClick={() => handleConfirmPayment(record.id, true)}
            >
              Xác nhận đã thanh toán
            </Button>
          </Space>
        );
      },
    },
    {
      title: "Tổng tiền",
      dataIndex: "total_amount",
      key: "total_amount",
      width: 150,
      sorter: (a, b) => a.total_amount - b.total_amount,
      render: (amount: number) => (
        <span style={{ fontWeight: 600, color: "#52c41a" }}>
          {formatCurrency(amount)}
        </span>
      ),
    },
    {
      title: "Ngày đặt",
      dataIndex: "created_at",
      key: "created_at",
      width: 180,
      sorter: (a, b) =>
        new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
      defaultSortOrder: "descend",
      render: (date: string) => new Date(date).toLocaleString("vi-VN"),
    },
    {
      title: "Địa chỉ",
      dataIndex: "customer_address",
      key: "customer_address",
      ellipsis: true,
      width: 250,
    },
    {
      title: "Thao tác",
      key: "actions",
      fixed: "right",
      width: 150,
      render: (_, record) => (
        <Space>
          <Button
            type="link"
            size="small"
            icon={<EyeOutlined />}
            onClick={() => handleOrderClick(record)}
          >
            Chi tiết
          </Button>
          <Button
            type="link"
            size="small"
            icon={<EditOutlined />}
            onClick={() => {
              // TODO: Quick edit functionality
              console.log("Edit order:", record.id);
            }}
          >
            Sửa
          </Button>
        </Space>
      ),
    },
  ];

  return (
    <div style={{ background: "#f5f5f5", minHeight: "100vh" }}>
      {/* Stats Cards */}
      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic
              title="Tổng đơn hàng"
              value={stats.totalOrders}
              prefix={<ShoppingOutlined />}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic
              title="Doanh thu"
              value={stats.totalRevenue}
              prefix={<DollarOutlined />}
              styles={{ content: { color: "#52c41a" } }}
              formatter={(value) => formatCurrency(value as number)}
            />
            <div style={{ fontSize: 12, color: "#8c8c8c", marginTop: 4 }}>
              Đơn đã giao
            </div>
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic
              title="Chờ xử lý"
              value={stats.pending}
              prefix={<ClockCircleOutlined />}
              styles={{ content: { color: "#faad14" } }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic
              title="Đang giao"
              value={stats.processing}
              prefix={<RocketOutlined />}
              styles={{ content: { color: "#1890ff" } }}
            />
          </Card>
        </Col>
      </Row>

      {/* Orders Table */}
      <Card
        title={
          <Space>
            <ShoppingOutlined />
            <span>Danh sách đơn hàng</span>
          </Space>
        }
        extra={
          <Button
            icon={<ReloadOutlined spin={isRefreshing} />}
            onClick={handleRefresh}
            loading={isRefreshing}
          >
            Làm mới
          </Button>
        }
      >
        <Table
          columns={columns}
          dataSource={orders}
          rowKey="id"
          loading={isLoading}
          scroll={{ x: 1200 }}
          pagination={{
            pageSize: 20,
            showSizeChanger: true,
            showTotal: (total) => `Tổng ${total} đơn hàng`,
            pageSizeOptions: ["10", "20", "50", "100"],
          }}
        />
      </Card>

      {/* Order Detail Modal */}
      <OrderDetailModal
        isOpen={isDetailModalOpen}
        onClose={() => setIsDetailModalOpen(false)}
        order={selectedOrder}
      />
    </div>
  );
}
