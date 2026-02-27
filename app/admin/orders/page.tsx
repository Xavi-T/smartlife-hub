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
  Dropdown,
  Modal,
  message,
} from "antd";
import type { ColumnsType } from "antd/es/table";
import type { MenuProps } from "antd";
import {
  ShoppingOutlined,
  ClockCircleOutlined,
  RocketOutlined,
  EyeOutlined,
  EditOutlined,
  PrinterOutlined,
  SearchOutlined,
  ReloadOutlined,
} from "@ant-design/icons";
import { OrderDetailModal } from "@/components/admin/OrderDetailModal";
import { formatCurrency } from "@/lib/utils";
import { buildInvoiceHtml, printInvoiceHtml } from "@/lib/invoice";

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
  const [updatingOrderId, setUpdatingOrderId] = useState<string | null>(null);

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

  const handleStatusChange = async (
    order: Order,
    newStatus: Order["status"],
  ) => {
    if (newStatus === order.status) return;

    const getConfirmMessage = (
      currentStatus: Order["status"],
      nextStatus: Order["status"],
    ): string | undefined => {
      if (currentStatus === "pending" && nextStatus === "processing") {
        return "Xác nhận đơn hàng này? Hàng sẽ được trừ khỏi kho.";
      }

      if (currentStatus === "processing" && nextStatus === "delivered") {
        return "Đánh dấu đơn hàng này đã giao?";
      }

      if (nextStatus === "cancelled" && currentStatus === "delivered") {
        return "Khách đã hoàn trả sau giao. Xác nhận hủy đơn và hoàn hàng về kho?";
      }

      if (nextStatus === "cancelled" && currentStatus === "processing") {
        return "Hủy đơn đang giao? Hàng sẽ được hoàn về kho.";
      }

      if (nextStatus === "cancelled" && currentStatus === "pending") {
        return "Hủy đơn chờ xác nhận?";
      }

      if (currentStatus === "processing" && nextStatus === "pending") {
        return "Chuyển lại về chờ xác nhận? Hàng sẽ được hoàn về kho.";
      }

      return undefined;
    };

    const confirmMessage = getConfirmMessage(order.status, newStatus);
    if (confirmMessage) {
      const shouldContinue = await new Promise<boolean>((resolve) => {
        Modal.confirm({
          title: "Xác nhận cập nhật trạng thái",
          content: confirmMessage,
          okText: "Xác nhận",
          cancelText: "Hủy",
          onOk: () => resolve(true),
          onCancel: () => resolve(false),
        });
      });

      if (!shouldContinue) return;
    }

    setUpdatingOrderId(order.id);

    try {
      const response = await fetch("/api/admin/orders/update-status", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orderId: order.id,
          newStatus,
          currentStatus: order.status,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Không thể cập nhật trạng thái");
      }

      message.success(result.message || "Đã cập nhật trạng thái đơn hàng");
      await fetchOrders();
    } catch (error) {
      console.error("Error updating status:", error);
      message.error(
        error instanceof Error
          ? error.message
          : "Đã xảy ra lỗi khi cập nhật trạng thái",
      );
    } finally {
      setUpdatingOrderId(null);
    }
  };

  const handleExportInvoice = (order: Order) => {
    let vatPercent = 0;

    Modal.confirm({
      title: "Xuất hoá đơn",
      okText: "In hoá đơn",
      cancelText: "Hủy",
      content: (
        <div style={{ marginTop: 12 }}>
          <div style={{ marginBottom: 8, color: "#595959" }}>
            Nhập % khấu trừ VAT áp dụng cho hóa đơn này.
          </div>
          <Input
            type="number"
            min={0}
            max={100}
            defaultValue={0}
            suffix="%"
            onChange={(event) => {
              vatPercent = Number(event.target.value || 0);
            }}
          />
        </div>
      ),
      onOk: () => {
        const html = buildInvoiceHtml(
          {
            orderId: order.id,
            orderDate: new Date(order.created_at).toLocaleString("vi-VN"),
            customerName: order.customer_name,
            customerPhone: order.customer_phone,
            customerAddress: order.customer_address,
            notes: order.notes,
            totalAmount: order.total_amount,
            items: order.order_items.map((item) => ({
              name: item.products?.name || "Sản phẩm",
              quantity: item.quantity,
              unitPrice: item.unit_price,
              subtotal: item.subtotal,
            })),
          },
          { vatPercent },
        );

        const ok = printInvoiceHtml(html);
        if (!ok) {
          message.error("Không thể xuất hóa đơn");
        }
      },
    });
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

  const filteredOrders = useMemo(() => {
    const keyword = searchQuery.trim().toLowerCase();
    if (!keyword) return orders;

    return orders.filter((order) => {
      const orderCode = order.id.slice(0, 8).toLowerCase();
      return (
        order.id.toLowerCase().includes(keyword) ||
        orderCode.includes(keyword) ||
        order.customer_name.toLowerCase().includes(keyword) ||
        order.customer_phone.toLowerCase().includes(keyword) ||
        order.customer_address.toLowerCase().includes(keyword)
      );
    });
  }, [orders, searchQuery]);

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
            value={(selectedKeys[0] as string) ?? ""}
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
      width: 320,
      render: (_, record) => (
        <Space>
          <Button
            type="link"
            size="small"
            icon={<PrinterOutlined />}
            onClick={() => handleExportInvoice(record)}
          >
            Xuất hóa đơn
          </Button>
          <Button
            type="link"
            size="small"
            icon={<EyeOutlined />}
            onClick={() => handleOrderClick(record)}
          >
            Chi tiết
          </Button>
          <Dropdown
            menu={{
              items: [
                {
                  key: "pending",
                  label: "Chờ xác nhận",
                  disabled:
                    record.status === "pending" ||
                    record.status === "delivered" ||
                    record.status === "cancelled",
                },
                {
                  key: "processing",
                  label: "Đang giao",
                  disabled:
                    record.status === "processing" ||
                    record.status === "delivered" ||
                    record.status === "cancelled",
                },
                {
                  key: "delivered",
                  label: "Đã giao",
                  disabled: record.status !== "processing",
                },
                {
                  key: "cancelled",
                  label: "Đã hủy",
                  disabled: record.status === "cancelled",
                },
              ] as MenuProps["items"],
              onClick: ({ key }) =>
                handleStatusChange(record, key as Order["status"]),
            }}
            trigger={["click"]}
          >
            <Button
              size="small"
              icon={<EditOutlined />}
              loading={updatingOrderId === record.id}
              disabled={
                updatingOrderId === record.id || record.status === "cancelled"
              }
            >
              Sửa
            </Button>
          </Dropdown>
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
          <Space>
            <Input
              allowClear
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder="Tìm mã đơn, tên khách, SĐT, địa chỉ"
              prefix={<SearchOutlined />}
              style={{ width: 320 }}
            />
            <Button
              icon={<ReloadOutlined spin={isRefreshing} />}
              onClick={handleRefresh}
              loading={isRefreshing}
            >
              Làm mới
            </Button>
          </Space>
        }
      >
        <Table
          columns={columns}
          dataSource={filteredOrders}
          rowKey="id"
          loading={isLoading}
          scroll={{ x: 1200 }}
          pagination={{
            pageSize: 20,
            showSizeChanger: true,
            showTotal: (total) =>
              searchQuery.trim()
                ? `Hiển thị ${total} / ${orders.length} đơn hàng`
                : `Tổng ${total} đơn hàng`,
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
