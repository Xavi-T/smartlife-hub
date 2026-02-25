"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  Button,
  Card,
  Col,
  Form,
  Input,
  InputNumber,
  Modal,
  Popconfirm,
  Row,
  Select,
  Space,
  Statistic,
  Switch,
  Table,
  Tag,
  Typography,
  message,
} from "antd";
import type { ColumnsType } from "antd/es/table";
import {
  CrownOutlined,
  PlusOutlined,
  ReloadOutlined,
  SearchOutlined,
  SyncOutlined,
  DeleteOutlined,
  EditOutlined,
  SaveOutlined,
} from "@ant-design/icons";
import { formatCurrency } from "@/lib/utils";
import { APP_CONFIG } from "@/lib/appConfig";

type PriorityCustomer = {
  id: string;
  customer_phone: string;
  customer_name: string;
  customer_segment: string;
  discount_percent: number;
  total_orders_snapshot: number;
  delivered_orders_snapshot: number;
  total_spent_snapshot: number;
  source: string;
  notes: string | null;
  is_active: boolean;
  last_order_at: string | null;
  updated_at: string;
};

type SegmentSetting = {
  id: string;
  segment_key: string;
  segment_label: string;
  min_delivered_orders: number;
  min_total_spent: number;
  discount_percent: number;
  is_priority: boolean;
  sort_order: number;
};

type FormValues = {
  customerName: string;
  customerPhone: string;
  customerSegment: string;
  notes?: string;
  isActive: boolean;
};

function PriorityCustomersContent() {
  const searchParams = useSearchParams();
  const [messageApi, contextHolder] = message.useMessage();
  const [customers, setCustomers] = useState<PriorityCustomer[]>([]);
  const [segments, setSegments] = useState<SegmentSetting[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [query, setQuery] = useState("");
  const [segmentFilter, setSegmentFilter] = useState<string>("all");
  const [activeFilter, setActiveFilter] = useState<string>("all");

  const [modalOpen, setModalOpen] = useState(false);
  const [segmentModalOpen, setSegmentModalOpen] = useState(false);
  const [editingCustomer, setEditingCustomer] =
    useState<PriorityCustomer | null>(null);
  const [form] = Form.useForm<FormValues>();
  const [segmentForm] = Form.useForm<{
    segmentLabel: string;
    minDeliveredOrders: number;
    minTotalSpent: number;
    discountPercent: number;
    isPriority: boolean;
  }>();

  const [segmentDrafts, setSegmentDrafts] = useState<SegmentSetting[]>([]);

  const examplePhone = useMemo(
    () => APP_CONFIG.shopPhone.replace(/\D/g, "") || "0901234567",
    [],
  );

  useEffect(() => {
    const initialSearch = searchParams.get("search") || "";
    if (initialSearch) {
      setQuery(initialSearch);
    }
  }, [searchParams]);

  const fetchSegments = async () => {
    const response = await fetch("/api/admin/priority-customers/segments");
    if (!response.ok) {
      const result = await response.json().catch(() => ({}));
      throw new Error(result.error || "Không thể tải phân loại khách hàng");
    }
    const result = await response.json();
    const loadedSegments = Array.isArray(result.segments)
      ? result.segments
      : [];
    setSegments(loadedSegments);
    setSegmentDrafts(loadedSegments);
  };

  const fetchCustomers = async () => {
    const params = new URLSearchParams();
    if (query.trim()) params.set("search", query.trim());
    if (segmentFilter !== "all") params.set("segment", segmentFilter);
    if (activeFilter !== "all") params.set("active", activeFilter);

    const response = await fetch(`/api/admin/priority-customers?${params}`);
    if (!response.ok) {
      const result = await response.json().catch(() => ({}));
      throw new Error(result.error || "Không thể tải khách hàng ưu tiên");
    }

    const result = await response.json();
    setCustomers(Array.isArray(result.customers) ? result.customers : []);
  };

  const fetchAll = async () => {
    setLoading(true);
    try {
      await Promise.all([fetchSegments(), fetchCustomers()]);
    } catch (error: unknown) {
      messageApi.error(
        error instanceof Error ? error.message : "Không thể tải dữ liệu",
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAll();
  }, []);

  useEffect(() => {
    fetchCustomers().catch((error: unknown) => {
      messageApi.error(
        error instanceof Error ? error.message : "Không thể tải dữ liệu",
      );
    });
  }, [query, segmentFilter, activeFilter]);

  const stats = useMemo(() => {
    const total = customers.length;
    const active = customers.filter((item) => item.is_active).length;
    const inactive = total - active;
    const totalSpend = customers.reduce(
      (sum, item) => sum + Number(item.total_spent_snapshot || 0),
      0,
    );

    return { total, active, inactive, totalSpend };
  }, [customers]);

  const openCreateModal = () => {
    setEditingCustomer(null);
    form.resetFields();
    form.setFieldsValue({
      customerSegment: segments[0]?.segment_key || "regular",
      isActive: true,
    });
    setModalOpen(true);
  };

  const openEditModal = (customer: PriorityCustomer) => {
    setEditingCustomer(customer);
    form.setFieldsValue({
      customerName: customer.customer_name,
      customerPhone: customer.customer_phone,
      customerSegment: customer.customer_segment,
      notes: customer.notes || undefined,
      isActive: customer.is_active,
    });
    setModalOpen(true);
  };

  const handleSubmitCustomer = async (values: FormValues) => {
    setSaving(true);
    try {
      const payload = {
        customerName: values.customerName,
        customerPhone: values.customerPhone,
        customerSegment: values.customerSegment,
        notes: values.notes,
        isActive: values.isActive,
      };

      const response = await fetch(
        editingCustomer
          ? `/api/admin/priority-customers/${editingCustomer.id}`
          : "/api/admin/priority-customers",
        {
          method: editingCustomer ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        },
      );

      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.error || "Không thể lưu khách hàng ưu tiên");
      }

      messageApi.success(result.message || "Lưu thành công");
      setModalOpen(false);
      await fetchCustomers();
    } catch (error: unknown) {
      messageApi.error(
        error instanceof Error ? error.message : "Không thể lưu dữ liệu",
      );
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      const response = await fetch(`/api/admin/priority-customers/${id}`, {
        method: "DELETE",
      });
      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Không thể xóa khách hàng ưu tiên");
      }

      messageApi.success(result.message || "Đã xóa");
      await fetchCustomers();
    } catch (error: unknown) {
      messageApi.error(
        error instanceof Error ? error.message : "Không thể xóa dữ liệu",
      );
    }
  };

  const handleSyncByRules = async () => {
    setSyncing(true);
    try {
      const response = await fetch(
        "/api/admin/priority-customers/apply-rules",
        {
          method: "POST",
        },
      );
      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Không thể áp điều kiện");
      }

      messageApi.success(result.message || "Đồng bộ thành công");
      await fetchCustomers();
    } catch (error: unknown) {
      messageApi.error(
        error instanceof Error ? error.message : "Không thể áp điều kiện",
      );
    } finally {
      setSyncing(false);
    }
  };

  const updateSegmentDraft = (
    id: string,
    key: keyof SegmentSetting,
    value: string | number | boolean | null,
  ) => {
    setSegmentDrafts((prev) =>
      prev.map((item) => (item.id === id ? { ...item, [key]: value } : item)),
    );
  };

  const saveSegmentSettings = async () => {
    setSaving(true);
    try {
      const response = await fetch("/api/admin/priority-customers/segments", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          updates: segmentDrafts.map((item) => ({
            id: item.id,
            segmentLabel: item.segment_label,
            minDeliveredOrders: item.min_delivered_orders,
            minTotalSpent: item.min_total_spent,
            discountPercent: item.discount_percent,
            isPriority: item.is_priority,
          })),
        }),
      });

      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.error || "Không thể lưu cấu hình phân loại");
      }

      messageApi.success(result.message || "Đã lưu cấu hình phân loại");
      setSegments(result.segments || []);
      setSegmentDrafts(result.segments || []);
    } catch (error: unknown) {
      messageApi.error(
        error instanceof Error ? error.message : "Không thể lưu cấu hình",
      );
    } finally {
      setSaving(false);
    }
  };

  const handleCreateSegment = async (values: {
    segmentLabel: string;
    minDeliveredOrders: number;
    minTotalSpent: number;
    discountPercent: number;
    isPriority: boolean;
  }) => {
    setSaving(true);
    try {
      const response = await fetch("/api/admin/priority-customers/segments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });

      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.error || "Không thể tạo phân loại");
      }

      messageApi.success(result.message || "Đã tạo phân loại");
      segmentForm.resetFields();
      setSegmentModalOpen(false);
      await fetchSegments();
    } catch (error: unknown) {
      messageApi.error(
        error instanceof Error ? error.message : "Không thể tạo phân loại",
      );
    } finally {
      setSaving(false);
    }
  };

  const openCreateSegmentModal = () => {
    segmentForm.resetFields();
    segmentForm.setFieldsValue({
      minDeliveredOrders: 1,
      minTotalSpent: 0,
      discountPercent: 0,
      isPriority: true,
    });
    setSegmentModalOpen(true);
  };

  const handleDeleteSegment = async (id: string) => {
    try {
      const response = await fetch(
        `/api/admin/priority-customers/segments/${id}`,
        {
          method: "DELETE",
        },
      );
      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Không thể xóa phân loại");
      }

      messageApi.success(result.message || "Đã xóa phân loại");
      await Promise.all([fetchSegments(), fetchCustomers()]);
    } catch (error: unknown) {
      messageApi.error(
        error instanceof Error ? error.message : "Không thể xóa phân loại",
      );
    }
  };

  const customerColumns: ColumnsType<PriorityCustomer> = [
    {
      title: "Khách hàng",
      key: "customer",
      render: (_value, record) => (
        <div>
          <Typography.Text strong>{record.customer_name}</Typography.Text>
          <br />
          <Typography.Text type="secondary">
            {record.customer_phone}
          </Typography.Text>
        </div>
      ),
      width: 240,
    },
    {
      title: "Phân loại",
      dataIndex: "customer_segment",
      key: "customer_segment",
      width: 180,
      render: (value: string) => <Tag color="gold">{value}</Tag>,
    },
    {
      title: "% giảm",
      dataIndex: "discount_percent",
      key: "discount_percent",
      width: 120,
      render: (value: number) => `${Number(value || 0)}%`,
    },
    {
      title: "Dữ liệu mua hàng",
      key: "snapshot",
      width: 260,
      render: (_value, record) => (
        <div>
          <div>{record.delivered_orders_snapshot} đơn đã giao</div>
          <Typography.Text type="secondary" style={{ fontSize: 12 }}>
            {formatCurrency(record.total_spent_snapshot)}
          </Typography.Text>
        </div>
      ),
    },
    {
      title: "Trạng thái",
      dataIndex: "is_active",
      key: "is_active",
      width: 120,
      render: (value: boolean) =>
        value ? <Tag color="success">Đang áp dụng</Tag> : <Tag>Tạm tắt</Tag>,
    },
    {
      title: "Thao tác",
      key: "actions",
      width: 160,
      render: (_value, record) => (
        <Space>
          <Button
            size="small"
            icon={<EditOutlined />}
            onClick={() => openEditModal(record)}
          >
            Sửa
          </Button>
          <Popconfirm
            title="Xóa khách hàng ưu tiên"
            description="Bạn chắc chắn muốn xóa khách hàng này khỏi danh sách ưu tiên?"
            okText="Xóa"
            cancelText="Hủy"
            onConfirm={() => handleDelete(record.id)}
          >
            <Button size="small" danger icon={<DeleteOutlined />} />
          </Popconfirm>
        </Space>
      ),
    },
  ];

  const segmentColumns: ColumnsType<SegmentSetting> = [
    {
      title: "Phân loại",
      key: "segment",
      render: (_value, record) => (
        <Input
          value={record.segment_label}
          onChange={(event) =>
            updateSegmentDraft(record.id, "segment_label", event.target.value)
          }
        />
      ),
      width: 220,
    },
    {
      title: "Điều kiện đơn đã giao",
      key: "min_delivered_orders",
      width: 180,
      render: (_value, record) => (
        <InputNumber
          min={0}
          value={record.min_delivered_orders}
          onChange={(value) =>
            updateSegmentDraft(
              record.id,
              "min_delivered_orders",
              Number(value || 0),
            )
          }
          style={{ width: "100%" }}
        />
      ),
    },
    {
      title: "Điều kiện doanh thu",
      key: "min_total_spent",
      width: 220,
      render: (_value, record) => (
        <InputNumber
          min={0}
          value={record.min_total_spent}
          onChange={(value) =>
            updateSegmentDraft(record.id, "min_total_spent", Number(value || 0))
          }
          style={{ width: "100%" }}
          formatter={(value) =>
            `${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ",")
          }
        />
      ),
    },
    {
      title: "% giảm mặc định",
      key: "discount_percent",
      width: 180,
      render: (_value, record) => (
        <InputNumber
          min={0}
          max={100}
          value={record.discount_percent}
          onChange={(value) =>
            updateSegmentDraft(
              record.id,
              "discount_percent",
              Number(value || 0),
            )
          }
          style={{ width: "100%" }}
        />
      ),
    },
    {
      title: "Áp dụng ưu tiên",
      key: "is_priority",
      width: 130,
      render: (_value, record) => (
        <Switch
          checked={record.is_priority}
          onChange={(checked) =>
            updateSegmentDraft(record.id, "is_priority", checked)
          }
        />
      ),
    },
    {
      title: "Xóa",
      key: "delete",
      width: 100,
      render: (_value, record) => (
        <Popconfirm
          title="Xóa phân loại này?"
          description="Khách hàng đang thuộc phân loại này sẽ được chuyển về regular."
          okText="Xóa"
          cancelText="Hủy"
          onConfirm={() => handleDeleteSegment(record.id)}
        >
          <Button size="small" danger icon={<DeleteOutlined />} />
        </Popconfirm>
      ),
    },
  ];

  return (
    <div>
      {contextHolder}
      <Space orientation="vertical" size={16} style={{ width: "100%" }}>
        <div>
          <Typography.Title level={2} style={{ marginBottom: 4 }}>
            Khách hàng ưu tiên
          </Typography.Title>
          <Typography.Text type="secondary">
            CRUD khách hàng ưu tiên, cấu hình phân loại và % giảm giá theo từng
            nhóm.
          </Typography.Text>
        </div>

        <Row gutter={[16, 16]}>
          <Col xs={24} sm={8}>
            <Card>
              <Statistic
                title="Tổng KH ưu tiên"
                value={stats.total}
                prefix={<CrownOutlined />}
              />
            </Card>
          </Col>
          <Col xs={24} sm={8}>
            <Card>
              <Statistic
                title="Đang áp dụng"
                value={stats.active}
                valueStyle={{ color: "#52c41a" }}
              />
            </Card>
          </Col>
          <Col xs={24} sm={8}>
            <Card>
              <Statistic
                title="Tổng chi tiêu snapshot"
                value={stats.totalSpend}
                formatter={(value) => formatCurrency(Number(value || 0))}
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
                placeholder="Tìm theo tên/SĐT"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                prefix={<SearchOutlined />}
                style={{ width: 260 }}
                allowClear
              />
              <Select
                value={segmentFilter}
                onChange={setSegmentFilter}
                style={{ width: 180 }}
                options={[
                  { value: "all", label: "Tất cả phân loại" },
                  ...segments.map((item) => ({
                    value: item.segment_key,
                    label: item.segment_label,
                  })),
                ]}
              />
              <Select
                value={activeFilter}
                onChange={setActiveFilter}
                style={{ width: 160 }}
                options={[
                  { value: "all", label: "Tất cả trạng thái" },
                  { value: "active", label: "Đang áp dụng" },
                  { value: "inactive", label: "Tạm tắt" },
                ]}
              />
            </Space>
            <Space>
              <Button
                icon={<ReloadOutlined />}
                onClick={fetchAll}
                loading={loading}
              >
                Làm mới
              </Button>
              <Button
                icon={<SyncOutlined />}
                onClick={handleSyncByRules}
                loading={syncing}
              >
                Áp điều kiện
              </Button>
              <Button
                type="primary"
                icon={<PlusOutlined />}
                onClick={openCreateModal}
              >
                Thêm khách ưu tiên
              </Button>
            </Space>
          </Space>
        </Card>

        <Card title="Danh sách khách hàng ưu tiên">
          <Table
            rowKey="id"
            columns={customerColumns}
            dataSource={customers}
            loading={loading}
            pagination={{
              pageSize: 20,
              showSizeChanger: true,
              showTotal: (total) => `Tổng ${total} khách hàng`,
            }}
            scroll={{ x: 1100 }}
          />
        </Card>

        <Card
          title="Cấu hình phân loại khách hàng & % giảm giá"
          extra={
            <Space>
              <Button icon={<PlusOutlined />} onClick={openCreateSegmentModal}>
                Thêm phân loại
              </Button>
              <Button
                type="primary"
                icon={<SaveOutlined />}
                onClick={saveSegmentSettings}
                loading={saving}
              >
                Lưu cấu hình phân loại
              </Button>
            </Space>
          }
        >
          <Typography.Paragraph type="secondary" style={{ marginTop: 0 }}>
            Thiết lập điều kiện để khách mua hàng trở thành khách hàng ưu tiên
            và % giảm giá mặc định theo từng phân loại.
          </Typography.Paragraph>

          <Typography.Paragraph type="secondary" style={{ marginTop: -8 }}>
            Nhấn "Thêm phân loại" để tạo mới. Các phân loại hiện có có thể chỉnh
            trực tiếp trong bảng bên dưới.
          </Typography.Paragraph>

          <Table
            rowKey="id"
            columns={segmentColumns}
            dataSource={segmentDrafts}
            pagination={false}
            scroll={{ x: 1000 }}
          />
        </Card>
      </Space>

      <Modal
        open={modalOpen}
        title={
          editingCustomer
            ? "Cập nhật khách hàng ưu tiên"
            : "Thêm khách hàng ưu tiên"
        }
        onCancel={() => setModalOpen(false)}
        onOk={() => form.submit()}
        okText={editingCustomer ? "Cập nhật" : "Tạo mới"}
        cancelText="Hủy"
        confirmLoading={saving}
        destroyOnHidden
      >
        <Form form={form} layout="vertical" onFinish={handleSubmitCustomer}>
          <Form.Item
            name="customerName"
            label="Tên khách hàng"
            rules={[
              { required: true, message: "Vui lòng nhập tên khách hàng" },
            ]}
          >
            <Input placeholder="Nguyễn Văn A" />
          </Form.Item>

          <Form.Item
            name="customerPhone"
            label="Số điện thoại"
            rules={[{ required: true, message: "Vui lòng nhập số điện thoại" }]}
          >
            <Input placeholder={examplePhone} />
          </Form.Item>

          <Form.Item
            name="customerSegment"
            label="Phân loại khách hàng"
            rules={[{ required: true, message: "Vui lòng chọn phân loại" }]}
          >
            <Select
              options={segments.map((item) => ({
                value: item.segment_key,
                label: item.segment_label,
              }))}
            />
          </Form.Item>

          <Form.Item name="notes" label="Ghi chú">
            <Input.TextArea rows={3} placeholder="Ghi chú thêm" />
          </Form.Item>

          <Form.Item name="isActive" label="Kích hoạt" valuePropName="checked">
            <Switch />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        open={segmentModalOpen}
        title="Thêm phân loại khách hàng"
        onCancel={() => setSegmentModalOpen(false)}
        onOk={() => segmentForm.submit()}
        okText="Tạo phân loại"
        cancelText="Hủy"
        confirmLoading={saving}
        destroyOnHidden
      >
        <Form
          form={segmentForm}
          layout="vertical"
          onFinish={handleCreateSegment}
        >
          <Form.Item
            name="segmentLabel"
            label="Tên phân loại"
            rules={[{ required: true, message: "Vui lòng nhập tên phân loại" }]}
          >
            <Input placeholder="Khách hàng VIP" />
          </Form.Item>

          <Row gutter={12}>
            <Col span={12}>
              <Form.Item
                name="minDeliveredOrders"
                label="Đơn đã giao tối thiểu"
              >
                <InputNumber min={0} style={{ width: "100%" }} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="minTotalSpent" label="Doanh thu tối thiểu">
                <InputNumber min={0} style={{ width: "100%" }} />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={12}>
            <Col span={24}>
              <Form.Item name="discountPercent" label="% giảm mặc định">
                <InputNumber min={0} max={100} style={{ width: "100%" }} />
              </Form.Item>
            </Col>
          </Row>

          <Form.Item
            name="isPriority"
            label="Áp dụng ưu tiên"
            valuePropName="checked"
          >
            <Switch checkedChildren="Ưu tiên" unCheckedChildren="Thường" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}

export default function PriorityCustomersPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center">
          <Space orientation="vertical" align="center">
            <SyncOutlined spin />
            <Typography.Text type="secondary">
              Đang tải dữ liệu...
            </Typography.Text>
          </Space>
        </div>
      }
    >
      <PriorityCustomersContent />
    </Suspense>
  );
}
