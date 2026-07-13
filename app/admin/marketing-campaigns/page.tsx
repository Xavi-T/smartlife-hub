"use client";

import { useEffect, useMemo, useState } from "react";
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
  DeleteOutlined,
  EditOutlined,
  GiftOutlined,
  PlusOutlined,
  ReloadOutlined,
} from "@ant-design/icons";

type CampaignType = "points_earn" | "points_redeem_voucher" | "gift";

interface CampaignConfig {
  pointsEarnRatePer1000?: number;
  pointsCost?: number;
  voucherType?: "percent" | "amount" | null;
  voucherValue?: number;
  maxDiscountAmount?: number;
  minOrderAmount?: number;
  expiresInDays?: number;
  giftName?: string | null;
  giftSku?: string | null;
  giftQuantity?: number;
  notes?: string | null;
}

interface MarketingCampaign {
  id: string;
  campaign_name: string;
  campaign_code: string | null;
  campaign_type: CampaignType;
  description: string | null;
  is_active: boolean;
  is_unlimited_time: boolean;
  start_at: string | null;
  end_at: string | null;
  priority: number;
  config: CampaignConfig;
  updated_at: string;
}

interface SegmentReportRow {
  segmentKey: string;
  segmentLabel: string;
  customerCount: number;
  earnedPoints: number;
  redeemedPoints: number;
  vouchersIssued: number;
  vouchersUsed: number;
  voucherDiscountAmount: number;
  voucherRevenue: number;
}

interface SegmentReportTotals {
  customerCount: number;
  earnedPoints: number;
  redeemedPoints: number;
  vouchersIssued: number;
  vouchersUsed: number;
  voucherDiscountAmount: number;
  voucherRevenue: number;
}

interface CampaignFormValues {
  name: string;
  code?: string;
  campaignType: CampaignType;
  description?: string;
  isActive: boolean;
  isUnlimitedTime: boolean;
  startAt?: string;
  endAt?: string;
  priority?: number;
  pointsEarnRatePer1000?: number;
  pointsCost?: number;
  voucherType?: "percent" | "amount";
  voucherValue?: number;
  maxDiscountAmount?: number;
  minOrderAmount?: number;
  expiresInDays?: number;
  giftName?: string;
  giftSku?: string;
  giftQuantity?: number;
  notes?: string;
}

const campaignTypeLabel: Record<CampaignType, string> = {
  points_earn: "Tích điểm",
  points_redeem_voucher: "Đổi điểm lấy voucher",
  gift: "Tặng quà",
};

function formatCampaignTime(campaign: MarketingCampaign): string {
  if (campaign.is_unlimited_time) return "Không giới hạn thời gian";
  if (!campaign.start_at || !campaign.end_at) return "Chưa cấu hình";

  return `${new Date(campaign.start_at).toLocaleString("vi-VN")} - ${new Date(
    campaign.end_at,
  ).toLocaleString("vi-VN")}`;
}

export default function MarketingCampaignsPage() {
  const [messageApi, contextHolder] = message.useMessage();
  const [form] = Form.useForm<CampaignFormValues>();
  const [campaigns, setCampaigns] = useState<MarketingCampaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [reportLoading, setReportLoading] = useState(true);
  const [segmentReports, setSegmentReports] = useState<SegmentReportRow[]>([]);
  const [reportTotals, setReportTotals] = useState<SegmentReportTotals | null>(
    null,
  );
  const [modalOpen, setModalOpen] = useState(false);
  const [editingCampaign, setEditingCampaign] =
    useState<MarketingCampaign | null>(null);

  const selectedCampaignType =
    (Form.useWatch("campaignType", form) as CampaignType | undefined) ||
    "points_earn";
  const isUnlimitedTime = Boolean(Form.useWatch("isUnlimitedTime", form));

  const fetchCampaigns = async () => {
    try {
      const response = await fetch("/api/admin/marketing-campaigns", {
        cache: "no-store",
      });
      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Không thể tải chiến dịch marketing");
      }

      setCampaigns(Array.isArray(result.campaigns) ? result.campaigns : []);
    } catch (error: unknown) {
      messageApi.error(
        error instanceof Error ? error.message : "Không thể tải dữ liệu",
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const fetchReports = async () => {
    try {
      setReportLoading(true);
      const response = await fetch("/api/admin/marketing-campaigns/reports", {
        cache: "no-store",
      });
      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.error || "Không thể tải báo cáo chiến dịch");
      }
      setSegmentReports(Array.isArray(result.reports) ? result.reports : []);
      setReportTotals(result.totals || null);
    } catch (error: unknown) {
      messageApi.error(
        error instanceof Error ? error.message : "Không thể tải báo cáo",
      );
    } finally {
      setReportLoading(false);
    }
  };

  useEffect(() => {
    fetchCampaigns();
    fetchReports();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const stats = useMemo(() => {
    const total = campaigns.length;
    const active = campaigns.filter((item) => item.is_active).length;
    const unlimited = campaigns.filter((item) => item.is_unlimited_time).length;

    return { total, active, unlimited };
  }, [campaigns]);

  const openCreateModal = () => {
    setEditingCampaign(null);
    form.resetFields();
    form.setFieldsValue({
      campaignType: "points_earn",
      isActive: true,
      isUnlimitedTime: false,
      priority: 100,
      pointsEarnRatePer1000: 1,
      voucherType: "amount",
      giftQuantity: 1,
    });
    setModalOpen(true);
  };

  const openEditModal = (campaign: MarketingCampaign) => {
    setEditingCampaign(campaign);
    form.setFieldsValue({
      name: campaign.campaign_name,
      code: campaign.campaign_code || undefined,
      campaignType: campaign.campaign_type,
      description: campaign.description || undefined,
      isActive: campaign.is_active,
      isUnlimitedTime: campaign.is_unlimited_time,
      startAt: campaign.start_at ? campaign.start_at.slice(0, 16) : undefined,
      endAt: campaign.end_at ? campaign.end_at.slice(0, 16) : undefined,
      priority: campaign.priority,
      pointsEarnRatePer1000: campaign.config?.pointsEarnRatePer1000,
      pointsCost: campaign.config?.pointsCost,
      voucherType:
        campaign.config?.voucherType === "percent" ? "percent" : "amount",
      voucherValue: campaign.config?.voucherValue,
      maxDiscountAmount: campaign.config?.maxDiscountAmount,
      minOrderAmount: campaign.config?.minOrderAmount,
      expiresInDays: campaign.config?.expiresInDays,
      giftName: campaign.config?.giftName || undefined,
      giftSku: campaign.config?.giftSku || undefined,
      giftQuantity: campaign.config?.giftQuantity,
      notes: campaign.config?.notes || undefined,
    });
    setModalOpen(true);
  };

  const handleSaveCampaign = async (values: CampaignFormValues) => {
    setSaving(true);
    try {
      const payload = {
        name: values.name,
        code: values.code,
        campaignType: values.campaignType,
        description: values.description,
        isActive: values.isActive,
        isUnlimitedTime: values.isUnlimitedTime,
        startAt:
          values.isUnlimitedTime || !values.startAt
            ? null
            : new Date(values.startAt).toISOString(),
        endAt:
          values.isUnlimitedTime || !values.endAt
            ? null
            : new Date(values.endAt).toISOString(),
        priority: Number(values.priority || 100),
        pointsEarnRatePer1000: Number(values.pointsEarnRatePer1000 || 0),
        pointsCost: Number(values.pointsCost || 0),
        voucherType: values.voucherType,
        voucherValue: Number(values.voucherValue || 0),
        maxDiscountAmount: Number(values.maxDiscountAmount || 0),
        minOrderAmount: Number(values.minOrderAmount || 0),
        expiresInDays: Number(values.expiresInDays || 0),
        giftName: values.giftName,
        giftSku: values.giftSku,
        giftQuantity: Number(values.giftQuantity || 0),
        notes: values.notes,
      };

      const response = await fetch(
        editingCampaign
          ? `/api/admin/marketing-campaigns/${editingCampaign.id}`
          : "/api/admin/marketing-campaigns",
        {
          method: editingCampaign ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        },
      );
      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Không thể lưu chiến dịch marketing");
      }

      messageApi.success(result.message || "Lưu thành công");
      setModalOpen(false);
      await fetchCampaigns();
    } catch (error: unknown) {
      messageApi.error(
        error instanceof Error ? error.message : "Không thể lưu chiến dịch",
      );
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteCampaign = async (id: string) => {
    try {
      const response = await fetch(`/api/admin/marketing-campaigns/${id}`, {
        method: "DELETE",
      });
      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Không thể xóa chiến dịch");
      }

      messageApi.success(result.message || "Đã xóa chiến dịch");
      await fetchCampaigns();
    } catch (error: unknown) {
      messageApi.error(
        error instanceof Error ? error.message : "Không thể xóa chiến dịch",
      );
    }
  };

  const reportColumns: ColumnsType<SegmentReportRow> = [
    {
      title: "Nhóm khách",
      dataIndex: "segmentLabel",
      key: "segmentLabel",
      render: (value: string) => (
        <Typography.Text strong>{value}</Typography.Text>
      ),
    },
    {
      title: "KH ưu tiên",
      dataIndex: "customerCount",
      key: "customerCount",
      align: "right",
      render: (value: number) => Number(value || 0).toLocaleString("vi-VN"),
    },
    {
      title: "Điểm tích",
      dataIndex: "earnedPoints",
      key: "earnedPoints",
      align: "right",
      render: (value: number) => Number(value || 0).toLocaleString("vi-VN"),
    },
    {
      title: "Điểm đã đổi",
      dataIndex: "redeemedPoints",
      key: "redeemedPoints",
      align: "right",
      render: (value: number) => Number(value || 0).toLocaleString("vi-VN"),
    },
    {
      title: "Voucher phát/dùng",
      key: "voucherUsage",
      align: "right",
      render: (_value, record) =>
        `${record.vouchersIssued}/${record.vouchersUsed}`,
    },
    {
      title: "Doanh thu voucher",
      dataIndex: "voucherRevenue",
      key: "voucherRevenue",
      align: "right",
      render: (value: number) =>
        `${Number(value || 0).toLocaleString("vi-VN")}đ`,
    },
    {
      title: "Chiết khấu voucher",
      dataIndex: "voucherDiscountAmount",
      key: "voucherDiscountAmount",
      align: "right",
      render: (value: number) =>
        `${Number(value || 0).toLocaleString("vi-VN")}đ`,
    },
  ];

  const columns: ColumnsType<MarketingCampaign> = [
    {
      title: "Chiến dịch",
      key: "campaign",
      render: (_value, record) => (
        <div>
          <Typography.Text strong>{record.campaign_name}</Typography.Text>
          <br />
          <Typography.Text type="secondary">
            {record.campaign_code || "Không có mã"}
          </Typography.Text>
        </div>
      ),
      width: 260,
    },
    {
      title: "Loại",
      dataIndex: "campaign_type",
      key: "campaign_type",
      width: 180,
      render: (value: CampaignType) => (
        <Tag color="blue">{campaignTypeLabel[value]}</Tag>
      ),
    },
    {
      title: "Thời gian",
      key: "time_window",
      width: 320,
      render: (_value, record) => (
        <Typography.Text>{formatCampaignTime(record)}</Typography.Text>
      ),
    },
    {
      title: "Trạng thái",
      key: "status",
      width: 130,
      render: (_value, record) =>
        record.is_active ? (
          <Tag color="success">Đang áp dụng</Tag>
        ) : (
          <Tag>Tạm tắt</Tag>
        ),
    },
    {
      title: "Thao tác",
      key: "actions",
      width: 170,
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
            title="Xóa chiến dịch"
            description="Bạn chắc chắn muốn xóa chiến dịch này?"
            okText="Xóa"
            cancelText="Hủy"
            onConfirm={() => handleDeleteCampaign(record.id)}
          >
            <Button size="small" danger icon={<DeleteOutlined />} />
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <div>
      {contextHolder}
      <Space direction="vertical" size={16} style={{ width: "100%" }}>
        <div>
          <Typography.Title level={2} style={{ marginBottom: 4 }}>
            Chiến dịch marketing
          </Typography.Title>
          <Typography.Text type="secondary">
            Tạo và quản lý chiến dịch tích điểm, đổi điểm lấy voucher và tặng
            quà cho chăm sóc khách hàng.
          </Typography.Text>
        </div>

        <Row gutter={[16, 16]}>
          <Col xs={24} sm={8}>
            <Card>
              <Statistic title="Tổng chiến dịch" value={stats.total} />
            </Card>
          </Col>
          <Col xs={24} sm={8}>
            <Card>
              <Statistic title="Đang áp dụng" value={stats.active} />
            </Card>
          </Col>
          <Col xs={24} sm={8}>
            <Card>
              <Statistic title="Không giới hạn" value={stats.unlimited} />
            </Card>
          </Col>
        </Row>

        <Card
          title="Danh sách chiến dịch"
          extra={
            <Space>
              <Button
                icon={<ReloadOutlined spin={refreshing} />}
                onClick={() => {
                  setRefreshing(true);
                  fetchCampaigns();
                }}
              >
                Làm mới
              </Button>
              <Button
                type="primary"
                icon={<PlusOutlined />}
                onClick={openCreateModal}
              >
                Tạo chiến dịch
              </Button>
            </Space>
          }
        >
          <Table
            rowKey="id"
            columns={columns}
            dataSource={campaigns}
            loading={loading}
            pagination={{ pageSize: 10 }}
            scroll={{ x: 1100 }}
          />
        </Card>

        <Card
          title="Báo cáo hiệu quả theo nhóm khách"
          extra={
            <Button
              icon={<ReloadOutlined spin={reportLoading} />}
              onClick={fetchReports}
              loading={reportLoading}
            >
              Làm mới báo cáo
            </Button>
          }
        >
          <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
            <Col xs={24} sm={8}>
              <Statistic
                title="Voucher đã dùng"
                value={reportTotals?.vouchersUsed || 0}
                suffix={`/ ${reportTotals?.vouchersIssued || 0} phát`}
              />
            </Col>
            <Col xs={24} sm={8}>
              <Statistic
                title="Doanh thu từ voucher"
                value={reportTotals?.voucherRevenue || 0}
                suffix="đ"
              />
            </Col>
            <Col xs={24} sm={8}>
              <Statistic
                title="Chiết khấu voucher"
                value={reportTotals?.voucherDiscountAmount || 0}
                suffix="đ"
              />
            </Col>
          </Row>
          <Table
            rowKey="segmentKey"
            columns={reportColumns}
            dataSource={segmentReports}
            loading={reportLoading}
            pagination={false}
            scroll={{ x: 900 }}
          />
        </Card>
      </Space>

      <Modal
        title={editingCampaign ? "Cập nhật chiến dịch" : "Tạo chiến dịch mới"}
        open={modalOpen}
        onCancel={() => {
          if (!saving) setModalOpen(false);
        }}
        onOk={() => form.submit()}
        okText={editingCampaign ? "Lưu thay đổi" : "Tạo chiến dịch"}
        cancelText="Hủy"
        confirmLoading={saving}
        width={860}
        destroyOnHidden
      >
        <Form form={form} layout="vertical" onFinish={handleSaveCampaign}>
          <Row gutter={12}>
            <Col xs={24} md={14}>
              <Form.Item
                name="name"
                label="Tên chiến dịch"
                rules={[
                  { required: true, message: "Vui lòng nhập tên chiến dịch" },
                ]}
              >
                <Input placeholder="Ví dụ: Mẹ bỉm tích điểm tháng khai trương" />
              </Form.Item>
            </Col>
            <Col xs={24} md={10}>
              <Form.Item name="code" label="Mã chiến dịch">
                <Input placeholder="KHAITRUONG_2026" />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={12}>
            <Col xs={24} md={10}>
              <Form.Item
                name="campaignType"
                label="Loại chiến dịch"
                rules={[
                  { required: true, message: "Vui lòng chọn loại chiến dịch" },
                ]}
              >
                <Select
                  options={[
                    { value: "points_earn", label: "Tích điểm" },
                    {
                      value: "points_redeem_voucher",
                      label: "Đổi điểm lấy voucher",
                    },
                    { value: "gift", label: "Tặng quà" },
                  ]}
                />
              </Form.Item>
            </Col>
            <Col xs={24} md={6}>
              <Form.Item name="priority" label="Độ ưu tiên">
                <InputNumber min={0} style={{ width: "100%" }} />
              </Form.Item>
            </Col>
            <Col xs={12} md={4}>
              <Form.Item
                name="isActive"
                label="Kích hoạt"
                valuePropName="checked"
              >
                <Switch />
              </Form.Item>
            </Col>
            <Col xs={12} md={4}>
              <Form.Item
                name="isUnlimitedTime"
                label="Không thời hạn"
                valuePropName="checked"
              >
                <Switch />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={12}>
            <Col xs={24} md={12}>
              <Form.Item
                name="startAt"
                label="Bắt đầu"
                rules={
                  isUnlimitedTime
                    ? []
                    : [
                        {
                          required: true,
                          message: "Vui lòng nhập thời gian bắt đầu",
                        },
                      ]
                }
              >
                <Input type="datetime-local" disabled={isUnlimitedTime} />
              </Form.Item>
            </Col>
            <Col xs={24} md={12}>
              <Form.Item
                name="endAt"
                label="Kết thúc"
                rules={
                  isUnlimitedTime
                    ? []
                    : [
                        {
                          required: true,
                          message: "Vui lòng nhập thời gian kết thúc",
                        },
                      ]
                }
              >
                <Input type="datetime-local" disabled={isUnlimitedTime} />
              </Form.Item>
            </Col>
          </Row>

          <Form.Item name="description" label="Mô tả chiến dịch">
            <Input.TextArea
              rows={2}
              placeholder="Mô tả ngắn mục tiêu chiến dịch"
            />
          </Form.Item>

          <Card
            size="small"
            title="Cấu hình phần thưởng"
            style={{ marginBottom: 12 }}
          >
            {selectedCampaignType === "points_earn" && (
              <Form.Item
                name="pointsEarnRatePer1000"
                label="Điểm nhận / 1.000đ"
                rules={[
                  { required: true, message: "Vui lòng nhập mức tích điểm" },
                ]}
              >
                <InputNumber min={0.1} step={0.1} style={{ width: "100%" }} />
              </Form.Item>
            )}

            {selectedCampaignType === "points_redeem_voucher" && (
              <Row gutter={12}>
                <Col xs={24} md={8}>
                  <Form.Item
                    name="pointsCost"
                    label="Điểm cần đổi"
                    rules={[
                      { required: true, message: "Vui lòng nhập điểm cần đổi" },
                    ]}
                  >
                    <InputNumber min={1} style={{ width: "100%" }} />
                  </Form.Item>
                </Col>
                <Col xs={24} md={8}>
                  <Form.Item
                    name="voucherType"
                    label="Loại voucher"
                    rules={[
                      { required: true, message: "Vui lòng chọn loại voucher" },
                    ]}
                  >
                    <Select
                      options={[
                        { value: "amount", label: "Giảm tiền" },
                        { value: "percent", label: "Giảm %" },
                      ]}
                    />
                  </Form.Item>
                </Col>
                <Col xs={24} md={8}>
                  <Form.Item
                    name="voucherValue"
                    label="Giá trị voucher"
                    rules={[
                      {
                        required: true,
                        message: "Vui lòng nhập giá trị voucher",
                      },
                    ]}
                  >
                    <InputNumber min={1} style={{ width: "100%" }} />
                  </Form.Item>
                </Col>
                <Col xs={24} md={8}>
                  <Form.Item name="maxDiscountAmount" label="Trần giảm tối đa">
                    <InputNumber min={0} style={{ width: "100%" }} />
                  </Form.Item>
                </Col>
                <Col xs={24} md={8}>
                  <Form.Item name="minOrderAmount" label="Đơn tối thiểu">
                    <InputNumber min={0} style={{ width: "100%" }} />
                  </Form.Item>
                </Col>
                <Col xs={24} md={8}>
                  <Form.Item name="expiresInDays" label="Hạn voucher (ngày)">
                    <InputNumber
                      min={0}
                      style={{ width: "100%" }}
                      placeholder="0 = không hạn"
                    />
                  </Form.Item>
                </Col>
              </Row>
            )}

            {selectedCampaignType === "gift" && (
              <Row gutter={12}>
                <Col xs={24} md={12}>
                  <Form.Item
                    name="giftName"
                    label="Tên quà tặng"
                    rules={[
                      { required: true, message: "Vui lòng nhập tên quà tặng" },
                    ]}
                  >
                    <Input placeholder="Ví dụ: Sample BioGaia mini" />
                  </Form.Item>
                </Col>
                <Col xs={24} md={6}>
                  <Form.Item name="giftSku" label="Mã quà (tuỳ chọn)">
                    <Input placeholder="GIFT001" />
                  </Form.Item>
                </Col>
                <Col xs={24} md={6}>
                  <Form.Item
                    name="giftQuantity"
                    label="Số lượng quà"
                    rules={[{ required: true, message: "Nhập số lượng" }]}
                  >
                    <InputNumber min={1} style={{ width: "100%" }} />
                  </Form.Item>
                </Col>
              </Row>
            )}
          </Card>

          <Form.Item name="notes" label="Ghi chú nội bộ">
            <Input.TextArea
              rows={3}
              placeholder="Điều kiện áp dụng, đối tượng khách hàng, lưu ý vận hành"
            />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
