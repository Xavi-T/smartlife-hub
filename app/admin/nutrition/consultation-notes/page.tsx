"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Button,
  Card,
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
  DeleteOutlined,
  EditOutlined,
  FileTextOutlined,
  MedicineBoxOutlined,
  PlusOutlined,
  ReloadOutlined,
} from "@ant-design/icons";
import {
  ACTIVITY_LEVEL_OPTIONS,
  GENDER_OPTIONS,
  GOAL_OPTIONS,
  getNutritionGoalLabel,
  type NutritionActivityLevel,
  type NutritionGender,
  type NutritionGoal,
} from "@/lib/nutrition";
import { getDisplayNutritionPhone } from "@/lib/nutritionConsultationNotes";
import type {
  NutritionConsultationNote,
  NutritionConsultationNoteStatus,
} from "@/types/database";

type NoteRow = NutritionConsultationNote & {
  nutrition_clients?: {
    id: string;
    full_name: string;
    phone: string;
  } | null;
};

interface NoteFormValues {
  fullName?: string;
  phone?: string;
  gender?: NutritionGender;
  birthDate?: string;
  ageYears?: number;
  heightCm?: number;
  weightKg?: number;
  activityLevel?: NutritionActivityLevel;
  goal?: NutritionGoal;
  medicalNotes?: string;
  allergies?: string;
  currentDiet?: string;
  quickNote?: string;
  recommendation?: string;
  status?: NutritionConsultationNoteStatus;
}

const statusOptions: Array<{
  label: string;
  value: NutritionConsultationNoteStatus | "all";
}> = [
  { label: "Tất cả", value: "all" },
  { label: "Note nháp", value: "draft" },
  { label: "Đã tạo hồ sơ", value: "converted" },
  { label: "Đã lưu trữ", value: "archived" },
];

function getStatusTag(status: NutritionConsultationNoteStatus) {
  if (status === "converted") return <Tag color="green">Đã tạo hồ sơ</Tag>;
  if (status === "archived") return <Tag>Đã lưu trữ</Tag>;
  return <Tag color="gold">Note nháp</Tag>;
}

function noteToFormValues(note: NoteRow): NoteFormValues {
  return {
    fullName: note.full_name || undefined,
    phone: note.phone || undefined,
    gender: note.gender || undefined,
    birthDate: note.birth_date || undefined,
    ageYears: note.age_years || undefined,
    heightCm: note.height_cm || undefined,
    weightKg: note.weight_kg || undefined,
    activityLevel: note.activity_level || undefined,
    goal: note.goal || undefined,
    medicalNotes: note.medical_notes || undefined,
    allergies: note.allergies || undefined,
    currentDiet: note.current_diet || undefined,
    quickNote: note.quick_note || undefined,
    recommendation: note.recommendation || undefined,
    status: note.status,
  };
}

export default function NutritionConsultationNotesPage() {
  const router = useRouter();
  const [form] = Form.useForm<NoteFormValues>();
  const [messageApi, contextHolder] = message.useMessage();
  const [notes, setNotes] = useState<NoteRow[]>([]);
  const [stats, setStats] = useState({
    total: 0,
    draft: 0,
    converted: 0,
    archived: 0,
  });
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [status, setStatus] = useState<NutritionConsultationNoteStatus | "all">(
    "all",
  );
  const [editingNote, setEditingNote] = useState<NoteRow | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [convertingId, setConvertingId] = useState<string | null>(null);

  const fetchNotes = useCallback(async (signal?: AbortSignal) => {
    setIsRefreshing(true);
    try {
      const params = new URLSearchParams();
      if (debouncedSearch) params.set("search", debouncedSearch);
      if (status !== "all") params.set("status", status);
      params.set("limit", "150");

      const response = await fetch(
        `/api/admin/nutrition/consultation-notes?${params.toString()}`,
        { cache: "no-store", signal },
      );
      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.error || "Không thể tải note tư vấn");
      }
      if (signal?.aborted) return;
      setNotes(Array.isArray(result.notes) ? result.notes : []);
      setStats(
        result.stats || { total: 0, draft: 0, converted: 0, archived: 0 },
      );
    } catch (error: unknown) {
      if (signal?.aborted) return;
      messageApi.error(
        error instanceof Error ? error.message : "Không thể tải note tư vấn",
      );
    } finally {
      if (!signal?.aborted) {
        setIsLoading(false);
        setIsRefreshing(false);
      }
    }
  }, [debouncedSearch, messageApi, status]);

  useEffect(() => {
    const timeoutId = window.setTimeout(
      () => setDebouncedSearch(search.trim()),
      250,
    );
    return () => window.clearTimeout(timeoutId);
  }, [search]);

  useEffect(() => {
    const controller = new AbortController();
    fetchNotes(controller.signal);
    return () => controller.abort();
  }, [fetchNotes]);

  const openCreateModal = () => {
    setEditingNote(null);
    form.resetFields();
    form.setFieldsValue({
      gender: "female",
      activityLevel: "light",
      goal: "improve_health",
      status: "draft",
    });
    setIsModalOpen(true);
  };

  const openEditModal = (note: NoteRow) => {
    setEditingNote(note);
    form.setFieldsValue(noteToFormValues(note));
    setIsModalOpen(true);
  };

  const handleSubmit = async (values: NoteFormValues) => {
    setIsSubmitting(true);
    try {
      const response = await fetch(
        editingNote
          ? `/api/admin/nutrition/consultation-notes/${editingNote.id}`
          : "/api/admin/nutrition/consultation-notes",
        {
          method: editingNote ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          cache: "no-store",
          body: JSON.stringify(values),
        },
      );
      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.error || "Không thể lưu note tư vấn");
      }

      messageApi.success(result.message || "Đã lưu note tư vấn");
      setIsModalOpen(false);
      form.resetFields();
      await fetchNotes();
    } catch (error: unknown) {
      messageApi.error(
        error instanceof Error ? error.message : "Không thể lưu note tư vấn",
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleConvert = async (note: NoteRow) => {
    setConvertingId(note.id);
    try {
      const response = await fetch(
        `/api/admin/nutrition/consultation-notes/${note.id}/convert`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          cache: "no-store",
          body: JSON.stringify({ consentGiven: true }),
        },
      );
      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.error || "Không thể tạo hồ sơ từ note");
      }

      messageApi.success(result.message || "Đã tạo hồ sơ tư vấn");
      await fetchNotes();
    } catch (error: unknown) {
      messageApi.error(
        error instanceof Error ? error.message : "Không thể tạo hồ sơ từ note",
      );
    } finally {
      setConvertingId(null);
    }
  };

  const handleDelete = async (note: NoteRow) => {
    try {
      const response = await fetch(
        `/api/admin/nutrition/consultation-notes/${note.id}`,
        { method: "DELETE", cache: "no-store" },
      );
      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.error || "Không thể xóa note tư vấn");
      }
      messageApi.success("Đã xóa note tư vấn");
      await fetchNotes();
    } catch (error: unknown) {
      messageApi.error(
        error instanceof Error ? error.message : "Không thể xóa note tư vấn",
      );
    }
  };

  const columns: ColumnsType<NoteRow> = [
    {
      title: "Khách / Liên hệ",
      key: "customer",
      width: 240,
      render: (_value, record) => (
        <Space direction="vertical" size={0}>
          <Typography.Text strong>
            {record.nutrition_clients?.full_name ||
              record.full_name ||
              "Khách tư vấn"}
          </Typography.Text>
          <Typography.Text type="secondary">
            {getDisplayNutritionPhone(
              record.nutrition_clients?.phone || record.phone,
            )}
          </Typography.Text>
          {record.nutrition_clients ? (
            <Tag color="green" style={{ width: "fit-content" }}>
              Đã link hồ sơ
            </Tag>
          ) : null}
        </Space>
      ),
    },
    {
      title: "Note nhanh",
      key: "note",
      render: (_value, record) => (
        <Space direction="vertical" size={4}>
          <Typography.Text>{record.quick_note || "-"}</Typography.Text>
          {record.medical_notes ? (
            <Typography.Text type="secondary" style={{ fontSize: 12 }}>
              Bệnh lý: {record.medical_notes}
            </Typography.Text>
          ) : null}
          {record.recommendation ? (
            <Typography.Text type="secondary" style={{ fontSize: 12 }}>
              Hướng xử lý: {record.recommendation}
            </Typography.Text>
          ) : null}
        </Space>
      ),
    },
    {
      title: "Chỉ số",
      key: "metrics",
      width: 160,
      render: (_value, record) => (
        <Space direction="vertical" size={0}>
          <Typography.Text>
            {record.height_cm ? `${record.height_cm} cm` : "-"} /{" "}
            {record.weight_kg ? `${record.weight_kg} kg` : "-"}
          </Typography.Text>
          <Typography.Text type="secondary" style={{ fontSize: 12 }}>
            {record.goal ? getNutritionGoalLabel(record.goal) : "-"}
          </Typography.Text>
        </Space>
      ),
    },
    {
      title: "Trạng thái",
      dataIndex: "status",
      key: "status",
      width: 140,
      render: (value: NutritionConsultationNoteStatus) => getStatusTag(value),
    },
    {
      title: "Ngày tạo",
      dataIndex: "created_at",
      key: "created_at",
      width: 170,
      render: (value: string) => new Date(value).toLocaleString("vi-VN"),
    },
    {
      title: "Thao tác",
      key: "actions",
      width: 260,
      render: (_value, record) => (
        <Space wrap>
          <Button
            size="small"
            icon={<EditOutlined />}
            onClick={() => openEditModal(record)}
          />
          {record.status !== "converted" ? (
            <Button
              size="small"
              type="primary"
              icon={<MedicineBoxOutlined />}
              loading={convertingId === record.id}
              onClick={() => handleConvert(record)}
            >
              Tạo hồ sơ
            </Button>
          ) : (
            <Button
              size="small"
              onClick={() =>
                record.client_id
                  ? router.push(
                      `/admin/nutrition/calculator?clientId=${record.client_id}`,
                    )
                  : router.push("/admin/nutrition/clients")
              }
            >
              Mở hồ sơ
            </Button>
          )}
          <Popconfirm
            title="Xóa note này?"
            okText="Xóa"
            cancelText="Hủy"
            okButtonProps={{ danger: true }}
            onConfirm={() => handleDelete(record)}
          >
            <Button size="small" danger icon={<DeleteOutlined />} />
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <div style={{ minHeight: "100vh", background: "#f5f5f5", padding: 16 }}>
      {contextHolder}

      <Space orientation="vertical" size={16} style={{ width: "100%" }}>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <Card>
            <Statistic title="Tổng note" value={stats.total} />
          </Card>
          <Card>
            <Statistic title="Note nháp" value={stats.draft} />
          </Card>
          <Card>
            <Statistic title="Đã tạo hồ sơ" value={stats.converted} />
          </Card>
          <Card>
            <Statistic title="Đã lưu trữ" value={stats.archived} />
          </Card>
        </div>

        <Card
          title={
            <Space>
              <FileTextOutlined />
              <span>Note tư vấn dinh dưỡng</span>
            </Space>
          }
          extra={
            <Space>
              <Button
                icon={<ReloadOutlined spin={isRefreshing} />}
                loading={isRefreshing}
                onClick={() => {
                  setIsRefreshing(true);
                  fetchNotes();
                }}
              >
                Làm mới
              </Button>
              <Button
                type="primary"
                icon={<PlusOutlined />}
                onClick={openCreateModal}
              >
                Tạo note nhanh
              </Button>
            </Space>
          }
        >
          <Space wrap style={{ marginBottom: 16 }}>
            <Input.Search
              allowClear
              placeholder="Tìm tên, SĐT hoặc nội dung note"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              style={{ width: 320 }}
            />
            <Select
              value={status}
              onChange={setStatus}
              options={statusOptions}
              style={{ width: 180 }}
            />
          </Space>

          <Table
            rowKey="id"
            loading={isLoading || isRefreshing}
            dataSource={notes}
            columns={columns}
            scroll={{ x: 1120 }}
            pagination={{
              pageSize: 12,
              showSizeChanger: true,
              pageSizeOptions: ["12", "24", "50"],
            }}
          />
        </Card>
      </Space>

      <Modal
        title={editingNote ? "Sửa note tư vấn" : "Tạo note tư vấn nhanh"}
        open={isModalOpen}
        onCancel={() => setIsModalOpen(false)}
        onOk={() => form.submit()}
        confirmLoading={isSubmitting}
        okText="Lưu note"
        cancelText="Hủy"
        width={900}
        destroyOnHidden
      >
        <Form<NoteFormValues>
          form={form}
          layout="vertical"
          onFinish={handleSubmit}
        >
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <Form.Item name="fullName" label="Tên khách">
              <Input placeholder="Có thể bổ sung sau" />
            </Form.Item>

            <Form.Item name="phone" label="Số điện thoại">
              <Input placeholder="Có thể bổ sung sau" />
            </Form.Item>

            <Form.Item name="gender" label="Giới tính">
              <Select allowClear options={GENDER_OPTIONS} />
            </Form.Item>

            <Form.Item name="birthDate" label="Ngày sinh">
              <Input type="date" />
            </Form.Item>

            <Form.Item name="ageYears" label="Tuổi">
              <InputNumber min={0} max={120} style={{ width: "100%" }} />
            </Form.Item>

            <Form.Item name="heightCm" label="Chiều cao (cm)">
              <InputNumber min={1} style={{ width: "100%" }} />
            </Form.Item>

            <Form.Item name="weightKg" label="Cân nặng (kg)">
              <InputNumber min={1} precision={1} style={{ width: "100%" }} />
            </Form.Item>

            <Form.Item name="goal" label="Mục tiêu">
              <Select allowClear options={GOAL_OPTIONS} />
            </Form.Item>

            <Form.Item name="activityLevel" label="Mức vận động">
              <Select allowClear options={ACTIVITY_LEVEL_OPTIONS} />
            </Form.Item>

            <Form.Item name="status" label="Trạng thái">
              <Select
                options={statusOptions.filter((item) => item.value !== "all")}
              />
            </Form.Item>
          </div>

          <Form.Item name="quickNote" label="Note nhanh">
            <Input.TextArea
              rows={4}
              placeholder="Ví dụ: khách muốn giảm cân sau sinh, hay thèm ngọt buổi tối..."
            />
          </Form.Item>

          <Form.Item name="medicalNotes" label="Bệnh lý/lưu ý sức khỏe">
            <Input.TextArea rows={2} placeholder="Tiểu đường, mỡ máu, dạ dày..." />
          </Form.Item>

          <Form.Item name="allergies" label="Dị ứng/kiêng kỵ">
            <Input.TextArea rows={2} placeholder="Dị ứng sữa, hải sản, ăn chay..." />
          </Form.Item>

          <Form.Item name="currentDiet" label="Chế độ ăn hiện tại">
            <Input.TextArea rows={2} placeholder="Bữa sáng, bữa phụ, thói quen ăn uống..." />
          </Form.Item>

          <Form.Item name="recommendation" label="Hướng tư vấn nhanh">
            <Input.TextArea rows={3} placeholder="Việc cần làm tiếp theo hoặc sản phẩm/chế độ gợi ý..." />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
