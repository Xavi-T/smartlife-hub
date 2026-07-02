"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Alert,
  Button,
  Card,
  Col,
  Form,
  Input,
  InputNumber,
  Modal,
  Progress,
  Row,
  Select,
  Space,
  Statistic,
  Table,
  Tag,
  Typography,
  message,
} from "antd";
import {
  BookOutlined,
  FilePdfOutlined,
  ProfileOutlined,
  ReloadOutlined,
  SettingOutlined,
  WalletOutlined,
} from "@ant-design/icons";
import type {
  RevenueThresholdStatus,
  TaxReadinessOverview,
} from "@/types/tax-readiness";

const { Title, Text, Paragraph, Link } = Typography;
const currentYear = new Date().getFullYear();
const moneyFormatter = new Intl.NumberFormat("vi-VN", {
  maximumFractionDigits: 0,
});

interface SettingsFormValues {
  annualRevenueThreshold: number;
  warningLevel1: number;
  warningLevel2: number;
  warningLevel3: number;
  currentBookCode: string;
  notes: string;
}

const statusPresentation: Record<
  RevenueThresholdStatus,
  { color: string; tag: string; message: string }
> = {
  safe: {
    color: "#1677ff",
    tag: "Trong ngưỡng theo dõi",
    message: "Doanh thu vẫn dưới mốc cảnh báo đầu tiên.",
  },
  attention: {
    color: "#faad14",
    tag: "Cần chú ý",
    message: "Doanh thu đã chạm mốc cảnh báo đầu tiên.",
  },
  warning: {
    color: "#fa8c16",
    tag: "Gần ngưỡng",
    message: "Nên rà soát nghĩa vụ thuế và phương án hóa đơn điện tử.",
  },
  exceeded: {
    color: "#ff4d4f",
    tag: "Đã đạt/vượt ngưỡng",
    message: "Cần xác minh nghĩa vụ thuế áp dụng với cơ quan hoặc chuyên gia thuế.",
  },
};

async function readResponse(response: Response) {
  const result = await response.json();
  if (!response.ok) {
    throw new Error(result.error || "Thao tác không thành công");
  }
  return result;
}

export default function TaxReadinessPage() {
  const router = useRouter();
  const [messageApi, contextHolder] = message.useMessage();
  const [settingsForm] = Form.useForm<SettingsFormValues>();
  const [overview, setOverview] = useState<TaxReadinessOverview | null>(null);
  const [year, setYear] = useState(currentYear);
  const [isLoading, setIsLoading] = useState(true);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const fetchOverview = useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await fetch(
        `/api/admin/tax-readiness/overview?year=${year}`,
        { cache: "no-store" },
      );
      const result = await readResponse(response);
      setOverview(result as TaxReadinessOverview);
    } catch (error) {
      messageApi.error(
        error instanceof Error ? error.message : "Không thể tải tổng quan",
      );
    } finally {
      setIsLoading(false);
    }
  }, [messageApi, year]);

  useEffect(() => {
    fetchOverview();
  }, [fetchOverview]);

  const openSettings = () => {
    if (!overview) return;
    settingsForm.setFieldsValue({
      annualRevenueThreshold: overview.settings.annualRevenueThreshold,
      warningLevel1: overview.settings.warningLevels[0],
      warningLevel2: overview.settings.warningLevels[1],
      warningLevel3: overview.settings.warningLevels[2],
      currentBookCode: overview.settings.currentBookCode,
      notes: overview.settings.notes,
    });
    setIsSettingsOpen(true);
  };

  const saveSettings = async (values: SettingsFormValues) => {
    setIsSaving(true);
    try {
      const response = await fetch("/api/admin/tax-readiness/overview", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          annualRevenueThreshold: values.annualRevenueThreshold,
          warningLevels: [
            values.warningLevel1,
            values.warningLevel2,
            values.warningLevel3,
          ],
          currentBookCode: values.currentBookCode,
          notes: values.notes,
        }),
      });
      await readResponse(response);
      messageApi.success("Đã cập nhật cấu hình theo dõi");
      setIsSettingsOpen(false);
      await fetchOverview();
    } catch (error) {
      messageApi.error(
        error instanceof Error ? error.message : "Không thể lưu cấu hình",
      );
    } finally {
      setIsSaving(false);
    }
  };

  const presentation = overview
    ? statusPresentation[overview.revenue.status]
    : statusPresentation.safe;
  const progressPercent = overview
    ? Math.min(100, Math.max(0, overview.revenue.percentage))
    : 0;
  const yearOptions = useMemo(
    () =>
      Array.from({ length: 5 }, (_, index) => currentYear - index).map(
        (value) => ({ value, label: `Năm ${value}` }),
      ),
    [],
  );

  return (
    <div style={{ maxWidth: 1400, margin: "0 auto" }}>
      {contextHolder}
      <Space
        align="start"
        style={{
          width: "100%",
          justifyContent: "space-between",
          marginBottom: 20,
        }}
        wrap
      >
        <div>
          <Title level={2} style={{ marginBottom: 4 }}>
            Tổng quan báo cáo & thuế
          </Title>
          <Text type="secondary">
            Theo dõi doanh thu hoàn thành và chuẩn bị dữ liệu sổ sách
          </Text>
        </div>
        <Space wrap>
          <Select
            value={year}
            options={yearOptions}
            onChange={setYear}
            style={{ width: 130 }}
          />
          <Button
            icon={<ReloadOutlined />}
            loading={isLoading}
            onClick={fetchOverview}
          >
            Làm mới
          </Button>
          <Button icon={<SettingOutlined />} onClick={openSettings}>
            Cấu hình
          </Button>
        </Space>
      </Space>

      <Alert
        showIcon
        type={overview?.revenue.status === "exceeded" ? "warning" : "info"}
        style={{ marginBottom: 20 }}
        message={
          <Space wrap>
            <span>
              Ngưỡng đang theo dõi:{" "}
              <strong>
                {moneyFormatter.format(
                  overview?.settings.annualRevenueThreshold || 1_000_000_000,
                )}{" "}
                đồng/năm
              </strong>
            </span>
            <Link
              href="https://www.mof.gov.vn/tin-tuc-tai-chinh/tin-tuc-su-kien-8/ho-ca-nhan-kinh-doanh-co-muc-doanh-thu-nam-tu-1-ty-dong-tro-xuong-khong-phai-nop-thue"
              target="_blank"
              rel="noreferrer"
            >
              Tham khảo Bộ Tài chính
            </Link>
          </Space>
        }
        description="Hệ thống hỗ trợ tổng hợp dữ liệu vận hành, không tự thay thế kết luận của cơ quan thuế."
      />

      <Row gutter={[16, 16]}>
        <Col xs={24} md={12} xl={6}>
          <Card loading={isLoading}>
            <Statistic
              title={`Doanh thu tính theo dõi ${year}`}
              value={overview?.revenue.total || 0}
              formatter={(value) => moneyFormatter.format(Number(value))}
              suffix="đ"
            />
            <Text type="secondary">
              {overview?.revenue.completedOrderCount || 0} đơn hoàn thành
            </Text>
          </Card>
        </Col>
        <Col xs={24} md={12} xl={6}>
          <Card loading={isLoading}>
            <Statistic
              title="Từ đơn hàng hoàn thành"
              value={overview?.revenue.completedOrders || 0}
              formatter={(value) => moneyFormatter.format(Number(value))}
              suffix="đ"
            />
            <Text type="secondary">Không tính đơn chờ, hủy hoặc đang giao</Text>
          </Card>
        </Col>
        <Col xs={24} md={12} xl={6}>
          <Card loading={isLoading}>
            <Statistic
              title="Thu nhập tính thuế nhập tay"
              value={overview?.revenue.manualTaxableIncome || 0}
              formatter={(value) => moneyFormatter.format(Number(value))}
              suffix="đ"
            />
            <Text type="secondary">Không liên kết với đơn bán hàng</Text>
          </Card>
        </Col>
        <Col xs={24} md={12} xl={6}>
          <Card loading={isLoading}>
            <Statistic
              title="Còn lại đến ngưỡng"
              value={overview?.revenue.remaining || 0}
              formatter={(value) => moneyFormatter.format(Number(value))}
              suffix="đ"
            />
            <Tag color={presentation.color} style={{ marginTop: 6 }}>
              {presentation.tag}
            </Tag>
          </Card>
        </Col>
      </Row>

      <Card
        title={`Tiến độ doanh thu năm ${year}`}
        loading={isLoading}
        style={{ marginTop: 16 }}
      >
        <Progress
          percent={Number(progressPercent.toFixed(1))}
          strokeColor={presentation.color}
          status={
            overview?.revenue.status === "exceeded" ? "exception" : "active"
          }
        />
        <Paragraph style={{ marginBottom: 0 }}>{presentation.message}</Paragraph>
      </Card>

      <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
        <Col xs={24} lg={10}>
          <Card title="Công cụ sổ sách" style={{ height: "100%" }}>
            <Space direction="vertical" size={12} style={{ width: "100%" }}>
              <Button
                block
                size="large"
                icon={<FilePdfOutlined />}
                onClick={() => router.push("/admin/tax-reports/s1a-hkd")}
              >
                Xem và xuất PDF S1a-HKD
              </Button>
              <Button
                block
                size="large"
                icon={<WalletOutlined />}
                onClick={() =>
                  router.push("/admin/tax-reports/transactions")
                }
              >
                Quản lý sổ thu–chi dự phòng
              </Button>
              <Button
                block
                size="large"
                icon={<ProfileOutlined />}
                onClick={() =>
                  router.push("/admin/tax-reports/product-tax-profiles")
                }
              >
                Chuẩn hóa hồ sơ thuế sản phẩm
              </Button>
            </Space>
            <Alert
              type="success"
              showIcon
              icon={<BookOutlined />}
              style={{ marginTop: 16 }}
              message={`Mẫu đang sử dụng: ${
                overview?.settings.currentBookCode || "S1a-HKD"
              }`}
              description="Các mẫu S2 chưa xuất PDF cho đến khi thực tế phát sinh nghĩa vụ phù hợp."
            />
          </Card>
        </Col>
        <Col xs={24} lg={14}>
          <Card title="Doanh thu theo tháng">
            <Table
              rowKey="month"
              size="small"
              loading={isLoading}
              pagination={false}
              scroll={{ y: 430 }}
              dataSource={overview?.monthlyRevenue || []}
              columns={[
                {
                  title: "Tháng",
                  dataIndex: "month",
                  width: 90,
                  render: (value: number) => `Tháng ${value}`,
                },
                {
                  title: "Đơn hoàn thành",
                  dataIndex: "orderCount",
                  align: "center",
                  width: 140,
                },
                {
                  title: "Doanh thu",
                  dataIndex: "amount",
                  align: "right",
                  render: (value: number) =>
                    `${moneyFormatter.format(value)} đ`,
                },
              ]}
            />
          </Card>
        </Col>
      </Row>

      <Modal
        title="Cấu hình theo dõi doanh thu"
        open={isSettingsOpen}
        onCancel={() => setIsSettingsOpen(false)}
        onOk={() => settingsForm.submit()}
        confirmLoading={isSaving}
        okText="Lưu cấu hình"
        cancelText="Hủy"
      >
        <Form
          form={settingsForm}
          layout="vertical"
          onFinish={saveSettings}
          style={{ marginTop: 20 }}
        >
          <Form.Item
            name="annualRevenueThreshold"
            label="Ngưỡng doanh thu năm (đồng)"
            rules={[{ required: true, message: "Nhập ngưỡng doanh thu" }]}
          >
            <InputNumber<number>
              min={1}
              precision={0}
              style={{ width: "100%" }}
              formatter={(value) =>
                value ? moneyFormatter.format(Number(value)) : ""
              }
              parser={(value) =>
                Number(String(value || "").replace(/\D/g, ""))
              }
            />
          </Form.Item>
          <Row gutter={12}>
            {[1, 2, 3].map((level) => (
              <Col span={8} key={level}>
                <Form.Item
                  name={`warningLevel${level}`}
                  label={`Cảnh báo ${level}`}
                  rules={[{ required: true }]}
                >
                  <InputNumber min={1} max={100} addonAfter="%" />
                </Form.Item>
              </Col>
            ))}
          </Row>
          <Form.Item
            name="currentBookCode"
            label="Mẫu sổ đang sử dụng"
            rules={[{ required: true }]}
          >
            <Input maxLength={20} />
          </Form.Item>
          <Form.Item name="notes" label="Ghi chú nội bộ">
            <Input.TextArea rows={3} maxLength={1000} showCount />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
