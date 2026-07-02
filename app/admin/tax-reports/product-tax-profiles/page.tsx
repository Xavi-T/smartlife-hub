"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Alert,
  Button,
  Card,
  Form,
  Input,
  InputNumber,
  Modal,
  Space,
  Table,
  Tag,
  Typography,
  message,
} from "antd";
import {
  EditOutlined,
  ReloadOutlined,
  SearchOutlined,
} from "@ant-design/icons";
import type { ProductTaxProfile } from "@/types/tax-readiness";

const { Title, Text } = Typography;

interface TaxProfileFormValues {
  taxGroupName: string;
  businessActivity: string;
  vatRatePercent: number | null;
  pitRatePercent: number | null;
  notes: string;
}

async function readResponse(response: Response) {
  const result = await response.json();
  if (!response.ok) throw new Error(result.error || "Thao tác không thành công");
  return result;
}

function formatRate(value: number | null) {
  return value === null ? "Chưa đặt" : `${value}%`;
}

export default function ProductTaxProfilesPage() {
  const [messageApi, contextHolder] = message.useMessage();
  const [form] = Form.useForm<TaxProfileFormValues>();
  const [profiles, setProfiles] = useState<ProductTaxProfile[]>([]);
  const [editing, setEditing] = useState<ProductTaxProfile | null>(null);
  const [search, setSearch] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [pagination, setPagination] = useState({
    page: 1,
    pageSize: 20,
    total: 0,
  });

  const fetchProfiles = useCallback(
    async (targetPage = pagination.page, targetSize = pagination.pageSize) => {
      setIsLoading(true);
      try {
        const params = new URLSearchParams({
          page: String(targetPage),
          pageSize: String(targetSize),
        });
        if (search.trim()) params.set("search", search.trim());
        const result = await readResponse(
          await fetch(`/api/admin/product-tax-profiles?${params}`, {
            cache: "no-store",
          }),
        );
        setProfiles(result.profiles || []);
        setPagination(result.pagination);
      } catch (error) {
        messageApi.error(
          error instanceof Error
            ? error.message
            : "Không thể tải hồ sơ thuế sản phẩm",
        );
      } finally {
        setIsLoading(false);
      }
    },
    [messageApi, pagination.page, pagination.pageSize, search],
  );

  useEffect(() => {
    fetchProfiles(1, pagination.pageSize);
    // Search is applied explicitly by the user.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const openEdit = (profile: ProductTaxProfile) => {
    setEditing(profile);
    form.setFieldsValue({
      taxGroupName: profile.taxGroupName,
      businessActivity: profile.businessActivity,
      vatRatePercent: profile.vatRatePercent,
      pitRatePercent: profile.pitRatePercent,
      notes: profile.notes,
    });
  };

  const saveProfile = async (values: TaxProfileFormValues) => {
    if (!editing) return;
    setIsSaving(true);
    try {
      await readResponse(
        await fetch("/api/admin/product-tax-profiles", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ productId: editing.productId, ...values }),
        }),
      );
      messageApi.success("Đã cập nhật hồ sơ thuế sản phẩm");
      setEditing(null);
      await fetchProfiles();
    } catch (error) {
      messageApi.error(
        error instanceof Error ? error.message : "Không thể lưu hồ sơ",
      );
    } finally {
      setIsSaving(false);
    }
  };

  const configuredCount = profiles.filter(
    (profile) => profile.isConfigured,
  ).length;

  return (
    <div style={{ maxWidth: 1400, margin: "0 auto" }}>
      {contextHolder}
      <div style={{ marginBottom: 20 }}>
        <Title level={2} style={{ marginBottom: 4 }}>
          Hồ sơ thuế sản phẩm
        </Title>
        <Text type="secondary">
          Chuẩn bị phân nhóm ngành nghề và thuế suất cho các mẫu S2 khi phát sinh
        </Text>
      </div>

      <Alert
        type="warning"
        showIcon
        style={{ marginBottom: 16 }}
        message="Hệ thống không tự gán thuế suất."
        description="Thuế suất phụ thuộc phương pháp tính thuế, ngành nghề và quy định tại thời điểm áp dụng. Chỉ nhập sau khi đã xác minh với cơ quan hoặc chuyên gia thuế."
      />

      <Card style={{ marginBottom: 16 }}>
        <Space wrap style={{ width: "100%", justifyContent: "space-between" }}>
          <Space wrap>
            <Input
              prefix={<SearchOutlined />}
              placeholder="Tìm tên sản phẩm"
              value={search}
              allowClear
              onChange={(event) => setSearch(event.target.value)}
              onPressEnter={() => fetchProfiles(1, pagination.pageSize)}
              style={{ width: 300 }}
            />
            <Button
              type="primary"
              icon={<SearchOutlined />}
              onClick={() => fetchProfiles(1, pagination.pageSize)}
            >
              Tìm
            </Button>
            <Button icon={<ReloadOutlined />} onClick={() => fetchProfiles()}>
              Làm mới
            </Button>
          </Space>
          <Text type="secondary">
            Đã cấu hình {configuredCount}/{profiles.length} sản phẩm trên trang
          </Text>
        </Space>
      </Card>

      <Card>
        <Table
          rowKey="productId"
          loading={isLoading}
          dataSource={profiles}
          scroll={{ x: 1000 }}
          pagination={{
            current: pagination.page,
            pageSize: pagination.pageSize,
            total: pagination.total,
            showSizeChanger: true,
            showTotal: (total) => `Tổng ${total} sản phẩm`,
            onChange: (page, pageSize) => fetchProfiles(page, pageSize),
          }}
          columns={[
            {
              title: "Sản phẩm",
              dataIndex: "productName",
              width: 280,
              render: (value: string, row: ProductTaxProfile) => (
                <div>
                  <Text strong>{value}</Text>
                  <br />
                  <Text type="secondary" style={{ fontSize: 12 }}>
                    Mã: {row.sku}
                  </Text>
                </div>
              ),
            },
            {
              title: "Nhóm thuế",
              dataIndex: "taxGroupName",
              width: 180,
              render: (value: string) => value || "—",
            },
            {
              title: "Hoạt động kinh doanh",
              dataIndex: "businessActivity",
              width: 220,
              render: (value: string) => value || "—",
            },
            {
              title: "GTGT",
              dataIndex: "vatRatePercent",
              align: "center",
              width: 100,
              render: formatRate,
            },
            {
              title: "TNCN",
              dataIndex: "pitRatePercent",
              align: "center",
              width: 100,
              render: formatRate,
            },
            {
              title: "Trạng thái",
              dataIndex: "isConfigured",
              align: "center",
              width: 130,
              render: (value: boolean) => (
                <Tag color={value ? "green" : "default"}>
                  {value ? "Đã cấu hình" : "Chưa cấu hình"}
                </Tag>
              ),
            },
            {
              title: "Thao tác",
              key: "action",
              fixed: "right",
              width: 90,
              render: (_: unknown, row: ProductTaxProfile) => (
                <Button
                  type="text"
                  icon={<EditOutlined />}
                  onClick={() => openEdit(row)}
                >
                  Sửa
                </Button>
              ),
            },
          ]}
        />
      </Card>

      <Modal
        title={`Hồ sơ thuế: ${editing?.productName || ""}`}
        open={Boolean(editing)}
        onCancel={() => setEditing(null)}
        onOk={() => form.submit()}
        confirmLoading={isSaving}
        okText="Lưu"
        cancelText="Hủy"
        width={620}
        destroyOnHidden
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={saveProfile}
          style={{ marginTop: 20 }}
        >
          <Form.Item name="taxGroupName" label="Tên nhóm thuế/ngành nghề">
            <Input placeholder="Ví dụ: Phân phối, cung cấp hàng hóa" />
          </Form.Item>
          <Form.Item name="businessActivity" label="Hoạt động kinh doanh">
            <Input placeholder="Mô tả hoạt động dùng để phân loại" />
          </Form.Item>
          <Space align="start" size={16} style={{ width: "100%" }}>
            <Form.Item
              name="vatRatePercent"
              label="Tỷ lệ thuế GTGT"
              style={{ flex: 1 }}
            >
              <InputNumber
                min={0}
                max={100}
                precision={4}
                addonAfter="%"
                style={{ width: "100%" }}
              />
            </Form.Item>
            <Form.Item
              name="pitRatePercent"
              label="Tỷ lệ thuế TNCN"
              style={{ flex: 1 }}
            >
              <InputNumber
                min={0}
                max={100}
                precision={4}
                addonAfter="%"
                style={{ width: "100%" }}
              />
            </Form.Item>
          </Space>
          <Form.Item name="notes" label="Ghi chú">
            <Input.TextArea rows={3} maxLength={1000} showCount />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
