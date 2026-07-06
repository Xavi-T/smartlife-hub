"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Button,
  Card,
  Checkbox,
  Descriptions,
  Drawer,
  Form,
  Input,
  InputNumber,
  Modal,
  Popconfirm,
  Select,
  Space,
  Statistic,
  Table,
  Tag,
  Typography,
  message,
} from "antd";
import type { ColumnsType } from "antd/es/table";
import {
  CalculatorOutlined,
  DeleteOutlined,
  EditOutlined,
  EyeOutlined,
  PlusOutlined,
  ReloadOutlined,
} from "@ant-design/icons";
import {
  ACTIVITY_LEVEL_OPTIONS,
  GENDER_OPTIONS,
  GOAL_OPTIONS,
  getActivityLevelLabel,
  getNutritionGoalLabel,
  type NutritionActivityLevel,
  type NutritionGender,
  type NutritionGoal,
} from "@/lib/nutrition";
import type {
  NutritionAssessment,
  NutritionClient,
  NutritionClientStatus,
} from "@/types/database";
import { formatNumber } from "@/lib/utils";

type ClientRow = NutritionClient & {
  assessment_count: number;
  latest_assessment_at: string | null;
};

interface ClientFormValues {
  fullName: string;
  phone: string;
  gender: NutritionGender;
  birthDate?: string;
  heightCm?: number;
  weightKg?: number;
  activityLevel: NutritionActivityLevel;
  goal: NutritionGoal;
  medicalNotes?: string;
  allergies?: string;
  doctorNotes?: string;
  status: NutritionClientStatus;
  consentGiven?: boolean;
}

const statusOptions: Array<{ label: string; value: NutritionClientStatus }> = [
  { label: "Mới", value: "new" },
  { label: "Đang theo dõi", value: "active" },
  { label: "Tạm dừng", value: "paused" },
  { label: "Hoàn thành", value: "completed" },
];

function getClientStatusTag(status: NutritionClientStatus) {
  if (status === "active") return <Tag color="green">Đang theo dõi</Tag>;
  if (status === "paused") return <Tag color="orange">Tạm dừng</Tag>;
  if (status === "completed") return <Tag color="blue">Hoàn thành</Tag>;
  return <Tag color="gold">Mới</Tag>;
}

function getGenderLabel(value: NutritionGender) {
  return GENDER_OPTIONS.find((item) => item.value === value)?.label || value;
}

export default function NutritionClientsPage() {
  const router = useRouter();
  const [form] = Form.useForm<ClientFormValues>();
  const [messageApi, contextHolder] = message.useMessage();
  const [clients, setClients] = useState<ClientRow[]>([]);
  const [stats, setStats] = useState({
    total: 0,
    active: 0,
    new: 0,
    paused: 0,
    completed: 0,
  });
  const [selectedClient, setSelectedClient] = useState<NutritionClient | null>(
    null,
  );
  const [assessments, setAssessments] = useState<NutritionAssessment[]>([]);
  const [editingClient, setEditingClient] = useState<ClientRow | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  const fetchClients = useCallback(async (signal?: AbortSignal) => {
    setIsRefreshing(true);
    try {
      const params = new URLSearchParams();
      if (debouncedSearch) params.set("search", debouncedSearch);
      if (statusFilter !== "all") params.set("status", statusFilter);
      const response = await fetch(
        `/api/admin/nutrition/clients?${params.toString()}`,
        { cache: "no-store", signal },
      );
      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.error || "Không thể tải hồ sơ");
      }
      if (signal?.aborted) return;
      setClients(Array.isArray(result.clients) ? result.clients : []);
      setStats(
        result.stats || {
          total: 0,
          active: 0,
          new: 0,
          paused: 0,
          completed: 0,
        },
      );
    } catch (error: unknown) {
      if (signal?.aborted) return;
      messageApi.error(
        error instanceof Error ? error.message : "Không thể tải hồ sơ",
      );
    } finally {
      if (!signal?.aborted) {
        setIsLoading(false);
        setIsRefreshing(false);
      }
    }
  }, [debouncedSearch, messageApi, statusFilter]);

  useEffect(() => {
    const timeoutId = window.setTimeout(
      () => setDebouncedSearch(search.trim()),
      300,
    );
    return () => window.clearTimeout(timeoutId);
  }, [search]);

  useEffect(() => {
    const controller = new AbortController();
    fetchClients(controller.signal);
    return () => controller.abort();
  }, [fetchClients]);

  const openCreateModal = () => {
    setEditingClient(null);
    form.resetFields();
    form.setFieldsValue({
      gender: "female",
      activityLevel: "light",
      goal: "maintain",
      status: "new",
      consentGiven: true,
    });
    setIsModalOpen(true);
  };

  const openEditModal = (client: ClientRow) => {
    setEditingClient(client);
    form.setFieldsValue({
      fullName: client.full_name,
      phone: client.phone,
      gender: client.gender,
      birthDate: client.birth_date || undefined,
      heightCm: client.height_cm || undefined,
      weightKg: client.weight_kg || undefined,
      activityLevel: client.activity_level,
      goal: client.goal,
      medicalNotes: client.medical_notes || undefined,
      allergies: client.allergies || undefined,
      doctorNotes: client.doctor_notes || undefined,
      status: client.status,
      consentGiven: client.consent_given,
    });
    setIsModalOpen(true);
  };

  const openDetail = async (client: ClientRow) => {
    try {
      setIsDetailOpen(true);
      setSelectedClient(client);
      setAssessments([]);
      const response = await fetch(`/api/admin/nutrition/clients/${client.id}`);
      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.error || "Không thể tải chi tiết hồ sơ");
      }
      setSelectedClient(result.client || client);
      setAssessments(
        Array.isArray(result.assessments) ? result.assessments : [],
      );
    } catch (error: unknown) {
      messageApi.error(
        error instanceof Error ? error.message : "Không thể tải chi tiết hồ sơ",
      );
    }
  };

  const handleSubmit = async (values: ClientFormValues) => {
    setIsSubmitting(true);
    try {
      const response = await fetch(
        editingClient
          ? `/api/admin/nutrition/clients/${editingClient.id}`
          : "/api/admin/nutrition/clients",
        {
          method: editingClient ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(values),
        },
      );
      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.error || "Không thể lưu hồ sơ");
      }

      messageApi.success(result.message || "Đã lưu hồ sơ");
      setIsModalOpen(false);
      form.resetFields();
      await fetchClients();
    } catch (error: unknown) {
      messageApi.error(
        error instanceof Error ? error.message : "Không thể lưu hồ sơ",
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      const response = await fetch(`/api/admin/nutrition/clients/${id}`, {
        method: "DELETE",
      });
      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.error || "Không thể xóa hồ sơ");
      }
      messageApi.success("Đã xóa hồ sơ");
      await fetchClients();
    } catch (error: unknown) {
      messageApi.error(
        error instanceof Error ? error.message : "Không thể xóa hồ sơ",
      );
    }
  };

  const columns: ColumnsType<ClientRow> = [
    {
      title: "Khách hàng",
      key: "client",
      render: (_value, record) => (
        <div>
          <Typography.Text strong>{record.full_name}</Typography.Text>
          <br />
          <Typography.Text type="secondary">{record.phone}</Typography.Text>
        </div>
      ),
    },
    {
      title: "Mục tiêu",
      dataIndex: "goal",
      key: "goal",
      width: 170,
      render: (value: NutritionGoal) => (
        <Tag color="blue">{getNutritionGoalLabel(value)}</Tag>
      ),
    },
    {
      title: "Chỉ số gần nhất",
      key: "metrics",
      width: 180,
      render: (_value, record) => (
        <Space orientation="vertical" size={0}>
          <Typography.Text>
            {record.height_cm ? `${record.height_cm} cm` : "-"} /{" "}
            {record.weight_kg ? `${record.weight_kg} kg` : "-"}
          </Typography.Text>
          <Typography.Text type="secondary" style={{ fontSize: 12 }}>
            {record.assessment_count} lần đánh giá
          </Typography.Text>
        </Space>
      ),
    },
    {
      title: "Trạng thái",
      dataIndex: "status",
      key: "status",
      width: 150,
      render: (value: NutritionClientStatus) => getClientStatusTag(value),
    },
    {
      title: "Cập nhật",
      dataIndex: "updated_at",
      key: "updated_at",
      width: 160,
      render: (value: string) => new Date(value).toLocaleString("vi-VN"),
    },
    {
      title: "Thao tác",
      key: "actions",
      width: 220,
      render: (_value, record) => (
        <Space>
          <Button
            size="small"
            icon={<EyeOutlined />}
            onClick={() => openDetail(record)}
          />
          <Button
            size="small"
            icon={<CalculatorOutlined />}
            onClick={() =>
              router.push(`/admin/nutrition/calculator?clientId=${record.id}`)
            }
          />
          <Button
            size="small"
            icon={<EditOutlined />}
            onClick={() => openEditModal(record)}
          />
          <Popconfirm
            title="Xóa hồ sơ này?"
            description="Lịch sử đánh giá của khách cũng sẽ bị xóa."
            okText="Xóa"
            cancelText="Hủy"
            okButtonProps={{ danger: true }}
            onConfirm={() => handleDelete(record.id)}
          >
            <Button size="small" danger icon={<DeleteOutlined />} />
          </Popconfirm>
        </Space>
      ),
    },
  ];

  const assessmentColumns: ColumnsType<NutritionAssessment> = [
    {
      title: "Ngày",
      dataIndex: "assessed_at",
      key: "assessed_at",
      render: (value: string) => new Date(value).toLocaleString("vi-VN"),
    },
    {
      title: "BMI",
      key: "bmi",
      render: (_value, record) => (
        <span>
          {record.bmi} - {record.bmi_category}
        </span>
      ),
    },
    {
      title: "Calo mục tiêu",
      dataIndex: "target_calories",
      key: "target_calories",
      render: (value: number) => `${formatNumber(value)} kcal`,
    },
    {
      title: "Macro",
      key: "macro",
      render: (_value, record) =>
        `P ${record.protein_g}g / F ${record.fat_g}g / C ${record.carb_g}g`,
    },
  ];

  const statusFilterOptions = useMemo(
    () => [{ label: "Tất cả trạng thái", value: "all" }, ...statusOptions],
    [],
  );

  return (
    <div style={{ minHeight: "100vh", background: "#f5f5f5", padding: 16 }}>
      {contextHolder}

      <Space orientation="vertical" size={16} style={{ width: "100%" }}>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <Card>
            <Statistic title="Tổng hồ sơ" value={stats.total} />
          </Card>
          <Card>
            <Statistic title="Đang theo dõi" value={stats.active} />
          </Card>
          <Card>
            <Statistic title="Khách mới" value={stats.new} />
          </Card>
          <Card>
            <Statistic title="Hoàn thành" value={stats.completed} />
          </Card>
        </div>

        <Card
          title="Hồ sơ tư vấn dinh dưỡng"
          extra={
            <Space>
              <Button
                icon={<ReloadOutlined spin={isRefreshing} />}
                loading={isRefreshing}
                onClick={() => {
                  setIsRefreshing(true);
                  fetchClients();
                }}
              >
                Làm mới
              </Button>
              <Button
                type="primary"
                icon={<PlusOutlined />}
                onClick={openCreateModal}
              >
                Tạo hồ sơ
              </Button>
            </Space>
          }
        >
          <Space wrap style={{ marginBottom: 16 }}>
            <Input.Search
              allowClear
              placeholder="Tìm tên hoặc SĐT"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              style={{ width: 280 }}
            />
            <Select
              value={statusFilter}
              onChange={setStatusFilter}
              options={statusFilterOptions}
              style={{ width: 190 }}
            />
          </Space>

          <Table
            rowKey="id"
            loading={isLoading || isRefreshing}
            dataSource={clients}
            columns={columns}
            pagination={{ pageSize: 10 }}
          />
        </Card>
      </Space>

      <Modal
        title={editingClient ? "Sửa hồ sơ tư vấn" : "Tạo hồ sơ tư vấn"}
        open={isModalOpen}
        onCancel={() => setIsModalOpen(false)}
        onOk={() => form.submit()}
        confirmLoading={isSubmitting}
        okText="Lưu"
        cancelText="Hủy"
        width={820}
        destroyOnHidden
      >
        <Form<ClientFormValues>
          form={form}
          layout="vertical"
          onFinish={handleSubmit}
        >
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <Form.Item
              name="fullName"
              label="Họ tên"
              rules={[{ required: true, message: "Vui lòng nhập họ tên" }]}
            >
              <Input placeholder="Nguyễn Văn A" />
            </Form.Item>

            <Form.Item
              name="phone"
              label="Số điện thoại"
              rules={[{ required: true, message: "Vui lòng nhập SĐT" }]}
            >
              <Input placeholder="090..." />
            </Form.Item>

            <Form.Item name="gender" label="Giới tính">
              <Select options={GENDER_OPTIONS} />
            </Form.Item>

            <Form.Item name="birthDate" label="Ngày sinh">
              <Input type="date" />
            </Form.Item>

            <Form.Item name="heightCm" label="Chiều cao (cm)">
              <InputNumber min={1} style={{ width: "100%" }} />
            </Form.Item>

            <Form.Item name="weightKg" label="Cân nặng (kg)">
              <InputNumber min={1} precision={1} style={{ width: "100%" }} />
            </Form.Item>

            <Form.Item name="activityLevel" label="Mức vận động">
              <Select options={ACTIVITY_LEVEL_OPTIONS} />
            </Form.Item>

            <Form.Item name="goal" label="Mục tiêu">
              <Select options={GOAL_OPTIONS} />
            </Form.Item>

            <Form.Item name="status" label="Trạng thái">
              <Select options={statusOptions} />
            </Form.Item>

            <Form.Item
              name="consentGiven"
              label="Đồng ý lưu thông tin tư vấn"
              valuePropName="checked"
            >
              <Checkbox>Khách đã đồng ý lưu thông tin tư vấn</Checkbox>
            </Form.Item>
          </div>

          <Form.Item name="medicalNotes" label="Ghi chú bệnh lý">
            <Input.TextArea rows={2} placeholder="Ví dụ: tiểu đường, mỡ máu..." />
          </Form.Item>
          <Form.Item name="allergies" label="Dị ứng/kiêng kỵ">
            <Input.TextArea rows={2} placeholder="Ví dụ: dị ứng sữa, hải sản..." />
          </Form.Item>
          <Form.Item name="doctorNotes" label="Ghi chú của bác sĩ">
            <Input.TextArea rows={3} />
          </Form.Item>
        </Form>
      </Modal>

      <Drawer
        title="Chi tiết hồ sơ tư vấn"
        width={820}
        open={isDetailOpen}
        onClose={() => setIsDetailOpen(false)}
        extra={
          selectedClient ? (
            <Button
              type="primary"
              icon={<CalculatorOutlined />}
              onClick={() =>
                router.push(
                  `/admin/nutrition/calculator?clientId=${selectedClient.id}`,
                )
              }
            >
              Tính dinh dưỡng
            </Button>
          ) : null
        }
      >
        {selectedClient && (
          <Space orientation="vertical" size={16} style={{ width: "100%" }}>
            <Descriptions bordered column={2} size="small">
              <Descriptions.Item label="Họ tên">
                {selectedClient.full_name}
              </Descriptions.Item>
              <Descriptions.Item label="SĐT">
                {selectedClient.phone}
              </Descriptions.Item>
              <Descriptions.Item label="Giới tính">
                {getGenderLabel(selectedClient.gender)}
              </Descriptions.Item>
              <Descriptions.Item label="Trạng thái">
                {getClientStatusTag(selectedClient.status)}
              </Descriptions.Item>
              <Descriptions.Item label="Mục tiêu">
                {getNutritionGoalLabel(selectedClient.goal)}
              </Descriptions.Item>
              <Descriptions.Item label="Vận động">
                {getActivityLevelLabel(selectedClient.activity_level)}
              </Descriptions.Item>
              <Descriptions.Item label="Chiều cao">
                {selectedClient.height_cm
                  ? `${selectedClient.height_cm} cm`
                  : "-"}
              </Descriptions.Item>
              <Descriptions.Item label="Cân nặng">
                {selectedClient.weight_kg
                  ? `${selectedClient.weight_kg} kg`
                  : "-"}
              </Descriptions.Item>
              <Descriptions.Item label="Bệnh lý" span={2}>
                {selectedClient.medical_notes || "-"}
              </Descriptions.Item>
              <Descriptions.Item label="Dị ứng" span={2}>
                {selectedClient.allergies || "-"}
              </Descriptions.Item>
              <Descriptions.Item label="Ghi chú bác sĩ" span={2}>
                {selectedClient.doctor_notes || "-"}
              </Descriptions.Item>
            </Descriptions>

            <Card title="Lịch sử đánh giá">
              <Table
                rowKey="id"
                dataSource={assessments}
                columns={assessmentColumns}
                pagination={{ pageSize: 5 }}
              />
            </Card>
          </Space>
        )}
      </Drawer>
    </div>
  );
}
