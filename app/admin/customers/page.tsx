"use client";

import { useState, useEffect } from "react";
import {
  Button,
  Card,
  Col,
  Descriptions,
  Empty,
  Input,
  Modal,
  Row,
  Select,
  Space,
  Spin,
  Statistic,
  Table,
  Tag,
  Typography,
  message,
} from "antd";
import type { ColumnsType } from "antd/es/table";
import {
  EyeOutlined,
  ReloadOutlined,
  SearchOutlined,
  ShoppingOutlined,
  TrophyOutlined,
  DollarOutlined,
  RiseOutlined,
} from "@ant-design/icons";
import { formatCurrency } from "@/lib/utils";

interface Customer {
  phone: string;
  name: string;
  totalOrders: number;
  totalSpent: number;
  deliveredOrders: number;
  lastOrderDate: string;
  firstOrderDate: string;
  customerType: string;
  typeColor: string;
  averageOrderValue: number;
}

interface CustomerStats {
  totalCustomers: number;
  newCustomers: number;
  regularCustomers: number;
  loyalCustomers: number;
  totalRevenue: number;
  averageLTV: number;
}

export default function CustomersPage() {
  const [messageApi, contextHolder] = message.useMessage();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [stats, setStats] = useState<CustomerStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [customerTypeFilter, setCustomerTypeFilter] = useState("all");

  // Detail modal state
  const [selectedPhone, setSelectedPhone] = useState<string | null>(null);
  const [customerDetail, setCustomerDetail] = useState<any>(null);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [isLoadingDetail, setIsLoadingDetail] = useState(false);

  const fetchCustomers = async () => {
    if (!isLoading) setIsRefreshing(true);
    try {
      const params = new URLSearchParams();
      if (searchQuery) params.append("search", searchQuery);
      if (customerTypeFilter !== "all")
        params.append("type", customerTypeFilter);

      const res = await fetch(`/api/admin/customers?${params}`);
      if (!res.ok) {
        const errorResult = await res.json().catch(() => ({}));
        throw new Error(errorResult.error || "Failed to fetch");
      }

      const data = await res.json();
      setCustomers(data.customers);
      setStats(data.stats);
    } catch (error: unknown) {
      console.error("Error fetching customers:", error);
      messageApi.error(
        error instanceof Error
          ? error.message
          : "Không thể tải danh sách khách hàng",
      );
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    fetchCustomers();
  }, [searchQuery, customerTypeFilter]);

  const handleRefresh = () => {
    setIsRefreshing(true);
    fetchCustomers();
  };

  const handleCustomerClick = async (phone: string) => {
    setSelectedPhone(phone);
    setIsDetailModalOpen(true);
    setIsLoadingDetail(true);

    try {
      const res = await fetch(
        `/api/admin/customers/${encodeURIComponent(phone)}`,
      );
      if (!res.ok) {
        const errorResult = await res.json().catch(() => ({}));
        throw new Error(errorResult.error || "Failed to fetch customer detail");
      }

      const data = await res.json();
      setCustomerDetail(data);
    } catch (error: unknown) {
      console.error("Error fetching customer detail:", error);
      messageApi.error("Không thể tải thông tin chi tiết khách hàng");
      setIsDetailModalOpen(false);
    } finally {
      setIsLoadingDetail(false);
    }
  };

  const statusTag = (status: string) => {
    const config = {
      pending: { color: "gold", label: "Chờ xác nhận" },
      processing: { color: "processing", label: "Đang giao" },
      delivered: { color: "success", label: "Đã giao" },
      cancelled: { color: "error", label: "Đã hủy" },
    } as const;

    const target = config[status as keyof typeof config] || config.pending;
    return <Tag color={target.color}>{target.label}</Tag>;
  };

  const customerTypeTag = (customer: Customer) => {
    const colorMap: Record<string, string> = {
      yellow: "gold",
      blue: "blue",
      purple: "purple",
    };

    return (
      <Tag color={colorMap[customer.typeColor] || "blue"}>
        {customer.customerType}
      </Tag>
    );
  };

  const columns: ColumnsType<Customer> = [
    {
      title: "Khách hàng",
      dataIndex: "name",
      key: "name",
      render: (_: string, record) => (
        <div>
          <Typography.Text strong>{record.name}</Typography.Text>
          <br />
          <Typography.Text type="secondary">{record.phone}</Typography.Text>
        </div>
      ),
    },
    {
      title: "Phân loại",
      key: "customerType",
      render: (_: unknown, record) => customerTypeTag(record),
      width: 180,
    },
    {
      title: "Tổng đơn",
      key: "totalOrders",
      width: 140,
      render: (_: unknown, record) => (
        <div>
          <Typography.Text strong>{record.totalOrders}</Typography.Text>
          <br />
          <Typography.Text type="secondary" style={{ fontSize: 12 }}>
            {record.deliveredOrders} đã giao
          </Typography.Text>
        </div>
      ),
    },
    {
      title: "LTV",
      dataIndex: "totalSpent",
      key: "totalSpent",
      align: "right",
      width: 160,
      render: (value: number) => (
        <Typography.Text strong style={{ color: "#52c41a" }}>
          {formatCurrency(value)}
        </Typography.Text>
      ),
    },
    {
      title: "TB/đơn",
      dataIndex: "averageOrderValue",
      key: "averageOrderValue",
      align: "right",
      width: 160,
      render: (value: number) => formatCurrency(value),
    },
    {
      title: "Đơn cuối",
      dataIndex: "lastOrderDate",
      key: "lastOrderDate",
      width: 180,
      render: (value: string) => new Date(value).toLocaleDateString("vi-VN"),
    },
    {
      title: "Thao tác",
      key: "actions",
      width: 120,
      render: (_: unknown, record) => (
        <Button
          type="link"
          icon={<EyeOutlined />}
          onClick={() => handleCustomerClick(record.phone)}
        >
          Chi tiết
        </Button>
      ),
    },
  ];

  const orderHistoryColumns: ColumnsType<any> = [
    {
      title: "Mã đơn",
      key: "id",
      render: (_: unknown, order: any) => (
        <Typography.Text strong>
          #{order.id.slice(0, 8).toUpperCase()}
        </Typography.Text>
      ),
      width: 140,
    },
    {
      title: "Ngày đặt",
      key: "created_at",
      render: (_: unknown, order: any) =>
        new Date(order.created_at).toLocaleString("vi-VN"),
      width: 220,
    },
    {
      title: "Trạng thái",
      key: "status",
      render: (_: unknown, order: any) => statusTag(order.status),
      width: 150,
    },
    {
      title: "Tổng tiền",
      key: "total_amount",
      align: "right",
      render: (_: unknown, order: any) => (
        <Typography.Text strong style={{ color: "#1677ff" }}>
          {formatCurrency(order.total_amount)}
        </Typography.Text>
      ),
      width: 180,
    },
  ];

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
    <div>
      {contextHolder}
      <Space orientation="vertical" size={16} style={{ width: "100%" }}>
        <div>
          <Typography.Title level={2} style={{ marginBottom: 4 }}>
            Quản lý Khách hàng
          </Typography.Title>
          <Typography.Text type="secondary">
            Phân tích và chăm sóc khách hàng
          </Typography.Text>
        </div>

        {stats && (
          <Row gutter={[16, 16]}>
            <Col xs={24} sm={12} lg={6}>
              <Card>
                <Statistic
                  title="Tổng khách hàng"
                  value={stats.totalCustomers}
                  prefix={<ShoppingOutlined />}
                />
              </Card>
            </Col>
            <Col xs={24} sm={12} lg={6}>
              <Card>
                <Statistic
                  title="Khách thân thiết"
                  value={stats.loyalCustomers}
                  prefix={<TrophyOutlined />}
                  style={{ color: "#722ed1" }}
                />
              </Card>
            </Col>
            <Col xs={24} sm={12} lg={6}>
              <Card>
                <Statistic
                  title="Tổng doanh thu"
                  value={stats.totalRevenue}
                  prefix={<DollarOutlined />}
                  formatter={(value) => formatCurrency(Number(value || 0))}
                  style={{ color: "#52c41a" }}
                />
              </Card>
            </Col>
            <Col xs={24} sm={12} lg={6}>
              <Card>
                <Statistic
                  title="LTV trung bình"
                  value={stats.averageLTV}
                  prefix={<RiseOutlined />}
                  formatter={(value) => formatCurrency(Number(value || 0))}
                />
              </Card>
            </Col>
          </Row>
        )}

        <Card>
          <Space
            wrap
            style={{ width: "100%", justifyContent: "space-between" }}
          >
            <Space wrap>
              <Input
                placeholder="Tìm theo tên hoặc SĐT..."
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                prefix={<SearchOutlined />}
                allowClear
                style={{ width: 280 }}
              />
              <Select
                value={customerTypeFilter}
                onChange={setCustomerTypeFilter}
                style={{ width: 220 }}
                options={[
                  { value: "all", label: "Tất cả khách hàng" },
                  { value: "new", label: "Khách mới (1 đơn)" },
                  { value: "regular", label: "Khách quen (2 đơn)" },
                  { value: "loyal", label: "Khách thân thiết (≥3 đơn)" },
                ]}
              />
            </Space>
            <Button
              icon={<ReloadOutlined spin={isRefreshing} />}
              onClick={handleRefresh}
              loading={isRefreshing}
            >
              Làm mới
            </Button>
          </Space>
        </Card>

        <Card>
          <Table
            rowKey="phone"
            columns={columns}
            dataSource={customers}
            loading={isRefreshing}
            locale={{
              emptyText: <Empty description="Không tìm thấy khách hàng" />,
            }}
            pagination={{
              pageSize: 20,
              showSizeChanger: true,
              pageSizeOptions: ["10", "20", "50", "100"],
              showTotal: (total) => `Tổng ${total} khách hàng`,
            }}
            scroll={{ x: 980 }}
          />
        </Card>
      </Space>

      <Modal
        title="Chi tiết khách hàng"
        open={isDetailModalOpen}
        onCancel={() => setIsDetailModalOpen(false)}
        footer={null}
        width={900}
        destroyOnHidden
      >
        {isLoadingDetail ? (
          <div style={{ textAlign: "center", padding: 32 }}>
            <Spin />
          </div>
        ) : !customerDetail ? (
          <Empty description="Không có dữ liệu khách hàng" />
        ) : (
          <Space orientation="vertical" size={16} style={{ width: "100%" }}>
            <Card size="small">
              <Descriptions column={2} size="small">
                <Descriptions.Item label="Khách hàng">
                  <Typography.Text strong>
                    {customerDetail.customer?.name}
                  </Typography.Text>
                </Descriptions.Item>
                <Descriptions.Item label="Số điện thoại">
                  {customerDetail.customer?.phone}
                </Descriptions.Item>
                <Descriptions.Item label="Địa chỉ" span={2}>
                  {customerDetail.customer?.address}
                </Descriptions.Item>
                <Descriptions.Item label="Phân loại">
                  <Tag>{customerDetail.customer?.customerType}</Tag>
                </Descriptions.Item>
              </Descriptions>
            </Card>

            <Row gutter={[12, 12]}>
              <Col xs={12} md={6}>
                <Card size="small">
                  <Statistic
                    title="Tổng đơn"
                    value={customerDetail.stats?.totalOrders || 0}
                  />
                </Card>
              </Col>
              <Col xs={12} md={6}>
                <Card size="small">
                  <Statistic
                    title="Đã giao"
                    value={customerDetail.stats?.deliveredOrders || 0}
                  />
                </Card>
              </Col>
              <Col xs={12} md={6}>
                <Card size="small">
                  <Statistic
                    title="Tổng chi tiêu"
                    value={customerDetail.stats?.totalSpent || 0}
                    formatter={(value) => formatCurrency(Number(value || 0))}
                  />
                </Card>
              </Col>
              <Col xs={12} md={6}>
                <Card size="small">
                  <Statistic
                    title="TB/đơn"
                    value={customerDetail.stats?.averageOrderValue || 0}
                    formatter={(value) => formatCurrency(Number(value || 0))}
                  />
                </Card>
              </Col>
            </Row>

            <Card
              size="small"
              title={`Lịch sử đơn hàng (${customerDetail.orders?.length || 0})`}
            >
              <Table
                rowKey="id"
                columns={orderHistoryColumns}
                dataSource={customerDetail.orders || []}
                pagination={false}
                size="small"
                scroll={{ x: 720 }}
              />
            </Card>
          </Space>
        )}
      </Modal>
    </div>
  );
}
