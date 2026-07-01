"use client";

import { useEffect, useMemo, useState } from "react";
import type { Dayjs } from "dayjs";
import dayjs from "dayjs";
import quarterOfYear from "dayjs/plugin/quarterOfYear";
import {
  Alert,
  Button,
  Card,
  Col,
  DatePicker,
  Form,
  Input,
  Row,
  Select,
  Space,
  Statistic,
  Table,
  Typography,
  message,
} from "antd";
import {
  DownloadOutlined,
  FilePdfOutlined,
  ReloadOutlined,
} from "@ant-design/icons";
import { APP_CONFIG } from "@/lib/appConfig";
import { downloadS1aHkdPdf } from "@/lib/s1aHkdPdf";
import {
  getS1aHkdDescription,
  type S1aHkdBusinessInfo,
  type S1aHkdDescriptionMode,
  type S1aHkdEntry,
  type S1aHkdReportResponse,
  type S1aHkdSummary,
} from "@/types/tax-report";

const { RangePicker } = DatePicker;
const SETTINGS_STORAGE_KEY = "smartlife-s1a-hkd-settings";

dayjs.extend(quarterOfYear);

interface S1aHkdFormValues extends S1aHkdBusinessInfo {
  dateRange: [Dayjs, Dayjs];
  descriptionMode: S1aHkdDescriptionMode;
}

const amountFormatter = new Intl.NumberFormat("vi-VN", {
  maximumFractionDigits: 0,
});

const completionDateFormatter = new Intl.DateTimeFormat("vi-VN", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  timeZone: "Asia/Ho_Chi_Minh",
});

function getDefaultPeriod(): string {
  return `Tháng ${dayjs().format("MM/YYYY")}`;
}

function getPeriodLabel(range: [Dayjs, Dayjs]): string {
  const [from, to] = range;
  if (
    from.isSame(from.startOf("month"), "day") &&
    to.isSame(to.endOf("month"), "day") &&
    from.isSame(to, "month")
  ) {
    return `Tháng ${from.format("MM/YYYY")}`;
  }
  if (
    from.isSame(from.startOf("year"), "day") &&
    to.isSame(to.endOf("year"), "day") &&
    from.isSame(to, "year")
  ) {
    return `Năm ${from.format("YYYY")}`;
  }
  return `Từ ${from.format("DD/MM/YYYY")} đến ${to.format("DD/MM/YYYY")}`;
}

function getStoredSettings(): Partial<S1aHkdFormValues> {
  if (typeof window === "undefined") return {};
  try {
    const rawValue = window.localStorage.getItem(SETTINGS_STORAGE_KEY);
    if (!rawValue) return {};
    return JSON.parse(rawValue) as Partial<S1aHkdFormValues>;
  } catch {
    return {};
  }
}

export default function S1aHkdReportPage() {
  const [form] = Form.useForm<S1aHkdFormValues>();
  const [messageApi, contextHolder] = message.useMessage();
  const [entries, setEntries] = useState<S1aHkdEntry[]>([]);
  const [summary, setSummary] = useState<S1aHkdSummary | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [hasLoaded, setHasLoaded] = useState(false);

  useEffect(() => {
    const storedSettings = getStoredSettings();
    form.setFieldsValue({
      householdName: storedSettings.householdName || APP_CONFIG.shopName,
      address: storedSettings.address || APP_CONFIG.shopAddress,
      taxCode: storedSettings.taxCode || APP_CONFIG.taxCode,
      businessLocation:
        storedSettings.businessLocation || APP_CONFIG.shopAddress,
      declarationPeriod:
        storedSettings.declarationPeriod || getDefaultPeriod(),
      unit: storedSettings.unit || "Đồng",
      representativeName: storedSettings.representativeName || "",
      signingLocation: storedSettings.signingLocation || "Hải Phòng",
      descriptionMode:
        storedSettings.descriptionMode || "order_and_products",
      dateRange: [dayjs().startOf("month"), dayjs().endOf("month")],
    });
  }, [form]);

  const persistSettings = (values: S1aHkdFormValues) => {
    const {
      householdName,
      address,
      taxCode,
      businessLocation,
      declarationPeriod,
      unit,
      representativeName,
      signingLocation,
      descriptionMode,
    } = values;
    window.localStorage.setItem(
      SETTINGS_STORAGE_KEY,
      JSON.stringify({
        householdName,
        address,
        taxCode,
        businessLocation,
        declarationPeriod,
        unit,
        representativeName,
        signingLocation,
        descriptionMode,
      }),
    );
  };

  const fetchReport = async (
    values: S1aHkdFormValues,
  ): Promise<S1aHkdReportResponse> => {
    const [from, to] = values.dateRange;
    const params = new URLSearchParams({
      from: from.format("YYYY-MM-DD"),
      to: to.format("YYYY-MM-DD"),
    });
    const response = await fetch(
      `/api/admin/reports/s1a-hkd?${params.toString()}`,
      { cache: "no-store" },
    );
    const result = await response.json();
    if (!response.ok) {
      throw new Error(result.error || "Không thể tải dữ liệu báo cáo");
    }
    return result as S1aHkdReportResponse;
  };

  const handlePreview = async () => {
    setIsLoading(true);
    try {
      const values = await form.validateFields();
      persistSettings(values);
      const result = await fetchReport(values);
      setEntries(result.entries || []);
      setSummary(result.summary);
      setHasLoaded(true);
      messageApi.success(
        `Đã tổng hợp ${result.summary.orderCount} đơn hàng hoàn thành`,
      );
    } catch (error) {
      if (error instanceof Error) {
        messageApi.error(error.message);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleExport = async () => {
    setIsExporting(true);
    try {
      const values = await form.validateFields();
      persistSettings(values);
      const result = await fetchReport(values);

      setEntries(result.entries || []);
      setSummary(result.summary);
      setHasLoaded(true);

      if (!result.entries.length) {
        messageApi.warning(
          "Không có đơn hàng hoàn thành trong kỳ để xuất PDF",
        );
        return;
      }

      await downloadS1aHkdPdf({
        businessInfo: {
          householdName: values.householdName.trim(),
          address: values.address.trim(),
          taxCode: values.taxCode.trim(),
          businessLocation: values.businessLocation.trim(),
          declarationPeriod: values.declarationPeriod.trim(),
          unit: values.unit.trim(),
          representativeName: values.representativeName?.trim() || "",
          signingLocation: values.signingLocation?.trim() || "",
        },
        entries: result.entries,
        descriptionMode: values.descriptionMode,
        signingDate: new Date(),
      });
      messageApi.success("Đã tạo và tải file PDF S1a-HKD");
    } catch (error) {
      messageApi.error(
        error instanceof Error ? error.message : "Không thể xuất file PDF",
      );
    } finally {
      setIsExporting(false);
    }
  };

  const descriptionMode =
    Form.useWatch("descriptionMode", form) || "order_and_products";

  const columns = useMemo(
    () => [
      {
        title: (
          <div style={{ textAlign: "center", fontWeight: 700 }}>
            <div>Ngày tháng</div>
            <div style={{ borderTop: "1px solid #d9d9d9", marginTop: 6 }}>
              A
            </div>
          </div>
        ),
        dataIndex: "completedAt",
        key: "completedAt",
        width: 150,
        align: "center" as const,
        render: (value: string) =>
          completionDateFormatter.format(new Date(value)),
      },
      {
        title: (
          <div style={{ textAlign: "center", fontWeight: 700 }}>
            <div>Diễn giải</div>
            <div style={{ borderTop: "1px solid #d9d9d9", marginTop: 6 }}>
              B
            </div>
          </div>
        ),
        key: "description",
        render: (_: unknown, record: S1aHkdEntry) =>
          getS1aHkdDescription(record, descriptionMode),
      },
      {
        title: (
          <div style={{ textAlign: "center", fontWeight: 700 }}>
            <div>Số tiền</div>
            <div style={{ borderTop: "1px solid #d9d9d9", marginTop: 6 }}>
              1
            </div>
          </div>
        ),
        dataIndex: "amount",
        key: "amount",
        width: 190,
        align: "right" as const,
        render: (value: number) => amountFormatter.format(Math.round(value)),
      },
    ],
    [descriptionMode],
  );

  return (
    <div style={{ minHeight: "100vh", background: "#f5f5f5", padding: 24 }}>
      {contextHolder}

      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          flexWrap: "wrap",
          gap: 16,
          marginBottom: 20,
        }}
      >
        <div>
          <Typography.Title level={2} style={{ margin: 0 }}>
            Sổ doanh thu S1a-HKD
          </Typography.Title>
          <Typography.Text type="secondary">
            Tổng hợp doanh thu từ đơn hàng đã hoàn thành và xuất PDF
          </Typography.Text>
        </div>
        <Space wrap>
          <Button
            icon={<ReloadOutlined />}
            loading={isLoading}
            onClick={handlePreview}
          >
            Tải dữ liệu
          </Button>
          <Button
            type="primary"
            icon={<DownloadOutlined />}
            loading={isExporting}
            onClick={handleExport}
          >
            Xuất PDF
          </Button>
        </Space>
      </div>

      <Alert
        type="info"
        showIcon
        style={{ marginBottom: 16 }}
        message="Mẫu số S1a-HKD theo Thông tư 152/2025/TT-BTC"
        description="Sổ lấy ngày đơn chuyển sang trạng thái Đã hoàn thành; mỗi đơn là một nghiệp vụ, số tiền là tổng thanh toán thực tế sau giảm giá. Hãy xác nhận mẫu này phù hợp phương pháp kê khai thuế của hộ kinh doanh trước khi sử dụng làm hồ sơ thuế."
      />

      <Form
        form={form}
        layout="vertical"
        requiredMark
        onValuesChange={(changedValues) => {
          const range = changedValues.dateRange as
            | [Dayjs, Dayjs]
            | undefined;
          if (range?.[0] && range?.[1]) {
            form.setFieldValue("declarationPeriod", getPeriodLabel(range));
          }
        }}
      >
        <Card title="Thông tin hộ, cá nhân kinh doanh">
          <Row gutter={16}>
            <Col xs={24} lg={12}>
              <Form.Item
                name="householdName"
                label="Hộ, cá nhân kinh doanh"
                rules={[
                  { required: true, message: "Vui lòng nhập tên hộ kinh doanh" },
                ]}
              >
                <Input placeholder="Tên hộ hoặc cá nhân kinh doanh" />
              </Form.Item>
            </Col>
            <Col xs={24} lg={12}>
              <Form.Item
                name="taxCode"
                label="Mã số thuế"
                rules={[
                  { required: true, message: "Vui lòng nhập mã số thuế" },
                ]}
              >
                <Input placeholder="Mã số thuế" />
              </Form.Item>
            </Col>
            <Col xs={24} lg={12}>
              <Form.Item
                name="address"
                label="Địa chỉ"
                rules={[{ required: true, message: "Vui lòng nhập địa chỉ" }]}
              >
                <Input placeholder="Địa chỉ đăng ký" />
              </Form.Item>
            </Col>
            <Col xs={24} lg={12}>
              <Form.Item
                name="businessLocation"
                label="Địa điểm kinh doanh"
                rules={[
                  {
                    required: true,
                    message: "Vui lòng nhập địa điểm kinh doanh",
                  },
                ]}
              >
                <Input placeholder="Địa điểm phát sinh doanh thu" />
              </Form.Item>
            </Col>
            <Col xs={24} lg={12}>
              <Form.Item
                name="representativeName"
                label="Người đại diện"
              >
                <Input placeholder="Họ tên người ký báo cáo" />
              </Form.Item>
            </Col>
            <Col xs={24} lg={12}>
              <Form.Item
                name="signingLocation"
                label="Địa điểm ký"
              >
                <Input placeholder="Ví dụ: Hải Phòng" />
              </Form.Item>
            </Col>
          </Row>
        </Card>

        <Card title="Kỳ kê khai và nội dung sổ" style={{ marginTop: 16 }}>
          <Row gutter={16}>
            <Col xs={24} lg={10}>
              <Form.Item
                name="dateRange"
                label="Khoảng ngày hoàn thành đơn"
                rules={[
                  { required: true, message: "Vui lòng chọn khoảng ngày" },
                ]}
              >
                <RangePicker
                  style={{ width: "100%" }}
                  format="DD/MM/YYYY"
                  presets={[
                    {
                      label: "Tháng này",
                      value: [dayjs().startOf("month"), dayjs().endOf("month")],
                    },
                    {
                      label: "Quý này",
                      value: [
                        dayjs().startOf("quarter"),
                        dayjs().endOf("quarter"),
                      ],
                    },
                    {
                      label: "Năm nay",
                      value: [dayjs().startOf("year"), dayjs().endOf("year")],
                    },
                  ]}
                />
              </Form.Item>
            </Col>
            <Col xs={24} lg={6}>
              <Form.Item
                name="declarationPeriod"
                label="Kỳ kê khai hiển thị"
                rules={[
                  { required: true, message: "Vui lòng nhập kỳ kê khai" },
                ]}
              >
                <Input placeholder="Ví dụ: Tháng 07/2026" />
              </Form.Item>
            </Col>
            <Col xs={24} lg={4}>
              <Form.Item
                name="unit"
                label="Đơn vị tính"
                rules={[
                  { required: true, message: "Vui lòng nhập đơn vị tính" },
                ]}
              >
                <Input placeholder="Đồng" />
              </Form.Item>
            </Col>
            <Col xs={24} lg={4}>
              <Form.Item
                name="descriptionMode"
                label="Diễn giải"
                rules={[{ required: true }]}
              >
                <Select
                  options={[
                    {
                      value: "order_and_products",
                      label: "Mã đơn + sản phẩm",
                    },
                    { value: "products", label: "Tên sản phẩm" },
                    { value: "order", label: "Mã đơn hàng" },
                  ]}
                />
              </Form.Item>
            </Col>
          </Row>
        </Card>
      </Form>

      <Row gutter={16} style={{ marginTop: 16 }}>
        <Col xs={24} sm={12}>
          <Card>
            <Statistic
              title="Số đơn hoàn thành"
              value={summary?.orderCount || 0}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12}>
          <Card>
            <Statistic
              title="Tổng doanh thu trong kỳ"
              value={summary?.totalAmount || 0}
              formatter={(value) =>
                `${amountFormatter.format(Number(value || 0))} đ`
              }
            />
          </Card>
        </Col>
      </Row>

      <Card
        title={
          <Space>
            <FilePdfOutlined />
            <span>Xem trước Data Grid S1a-HKD</span>
          </Space>
        }
        style={{ marginTop: 16 }}
      >
        <Table<S1aHkdEntry>
          bordered
          rowKey="orderId"
          loading={isLoading}
          columns={columns}
          dataSource={entries}
          scroll={{ x: 760 }}
          locale={{
            emptyText: hasLoaded
              ? "Không có đơn hoàn thành trong kỳ đã chọn"
              : "Chọn kỳ kê khai và bấm Tải dữ liệu",
          }}
          pagination={{
            pageSize: 20,
            showSizeChanger: true,
            showTotal: (total) => `${total} nghiệp vụ`,
          }}
          summary={() =>
            entries.length > 0 ? (
              <Table.Summary.Row>
                <Table.Summary.Cell index={0} />
                <Table.Summary.Cell index={1} align="center">
                  <strong>Tổng cộng</strong>
                </Table.Summary.Cell>
                <Table.Summary.Cell index={2} align="right">
                  <strong>
                    {amountFormatter.format(summary?.totalAmount || 0)}
                  </strong>
                </Table.Summary.Cell>
              </Table.Summary.Row>
            ) : null
          }
        />
      </Card>
    </div>
  );
}
