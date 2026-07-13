"use client";

import { useMemo, useState } from "react";
import {
  Alert,
  Button,
  Card,
  Col,
  Empty,
  Form,
  Input,
  Modal,
  Row,
  Select,
  Space,
  Statistic,
  Table,
  Tag,
  Typography,
  message,
} from "antd";
import type { ColumnsType } from "antd/es/table";
import { CopyOutlined, GiftOutlined, SearchOutlined } from "@ant-design/icons";

interface WalletData {
  customer_phone: string;
  total_points: number;
  lifetime_earned_points: number;
  lifetime_redeemed_points: number;
  last_transaction_at: string | null;
}

interface PointTransaction {
  id: string;
  direction: "earn" | "redeem" | "adjust";
  points: number;
  reference_type: string | null;
  reference_id: string | null;
  note: string | null;
  created_at: string;
}

interface CustomerVoucher {
  id: string;
  voucher_code: string;
  voucher_type: "percent" | "amount";
  voucher_value: number;
  status: "active" | "used" | "expired" | "cancelled";
  expires_at: string | null;
  used_at: string | null;
}

interface RedeemCampaign {
  id: string;
  campaign_name: string;
  config: {
    pointsCost?: number;
    voucherType?: "percent" | "amount";
    voucherValue?: number;
  };
}

interface WalletResponse {
  wallet: WalletData;
  transactions: PointTransaction[];
  vouchers: CustomerVoucher[];
  redeemCampaigns: RedeemCampaign[];
}

function normalizePhone(value: string): string {
  return String(value || "").replace(/\D/g, "");
}

function formatVoucherValue(voucher: CustomerVoucher): string {
  if (voucher.voucher_type === "percent")
    return `${Number(voucher.voucher_value || 0)}%`;
  return `${Number(voucher.voucher_value || 0).toLocaleString("vi-VN")}đ`;
}

export default function CustomerWalletsPage() {
  const [messageApi, contextHolder] = message.useMessage();
  const [form] = Form.useForm<{ phone: string }>();
  const [redeemForm] = Form.useForm<{ campaignId: string }>();
  const [loading, setLoading] = useState(false);
  const [redeeming, setRedeeming] = useState(false);
  const [phone, setPhone] = useState("");
  const [data, setData] = useState<WalletResponse | null>(null);
  const [redeemModalOpen, setRedeemModalOpen] = useState(false);

  const normalizedPhone = useMemo(() => normalizePhone(phone), [phone]);

  const loadWallet = async (targetPhone: string) => {
    const cleanPhone = normalizePhone(targetPhone);
    if (!cleanPhone) {
      messageApi.warning("Vui lòng nhập số điện thoại khách hàng");
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(
        `/api/admin/customer-wallets/${cleanPhone}`,
        {
          cache: "no-store",
        },
      );
      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.error || "Không thể tải ví điểm");
      }
      setPhone(cleanPhone);
      setData(result);
    } catch (error: unknown) {
      messageApi.error(
        error instanceof Error ? error.message : "Không thể tải dữ liệu",
      );
    } finally {
      setLoading(false);
    }
  };

  const handleRedeem = async (values: { campaignId: string }) => {
    if (!normalizedPhone) return;
    setRedeeming(true);
    try {
      const response = await fetch(
        `/api/admin/customer-wallets/${normalizedPhone}/redeem`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(values),
        },
      );
      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.error || "Không thể đổi điểm");
      }
      messageApi.success(result.message || "Đổi điểm thành công");
      setRedeemModalOpen(false);
      redeemForm.resetFields();
      await loadWallet(normalizedPhone);
    } catch (error: unknown) {
      messageApi.error(
        error instanceof Error ? error.message : "Không thể đổi điểm",
      );
    } finally {
      setRedeeming(false);
    }
  };

  const copyVoucher = async (code: string) => {
    try {
      await navigator.clipboard.writeText(code);
      messageApi.success("Đã copy mã voucher");
    } catch {
      messageApi.error("Không thể copy mã voucher");
    }
  };

  const transactionColumns: ColumnsType<PointTransaction> = [
    {
      title: "Loại",
      dataIndex: "direction",
      key: "direction",
      width: 120,
      render: (value: PointTransaction["direction"]) => {
        if (value === "earn") return <Tag color="success">Cộng điểm</Tag>;
        if (value === "redeem") return <Tag color="blue">Đổi điểm</Tag>;
        return <Tag color="orange">Điều chỉnh</Tag>;
      },
    },
    {
      title: "Điểm",
      dataIndex: "points",
      key: "points",
      width: 120,
      render: (value: number, record) => (
        <Typography.Text
          strong
          style={{ color: record.direction === "earn" ? "#52c41a" : "#cf1322" }}
        >
          {record.direction === "earn" ? "+" : "-"}
          {Number(value || 0).toLocaleString("vi-VN")}
        </Typography.Text>
      ),
    },
    {
      title: "Nội dung",
      dataIndex: "note",
      key: "note",
    },
    {
      title: "Thời gian",
      dataIndex: "created_at",
      key: "created_at",
      width: 180,
      render: (value: string) => new Date(value).toLocaleString("vi-VN"),
    },
  ];

  const voucherColumns: ColumnsType<CustomerVoucher> = [
    {
      title: "Mã voucher",
      dataIndex: "voucher_code",
      key: "voucher_code",
      render: (value: string) => (
        <Space>
          <Typography.Text code>{value}</Typography.Text>
          <Button
            size="small"
            icon={<CopyOutlined />}
            onClick={() => copyVoucher(value)}
          />
        </Space>
      ),
    },
    {
      title: "Giá trị",
      key: "value",
      width: 120,
      render: (_value, record) => formatVoucherValue(record),
    },
    {
      title: "Trạng thái",
      dataIndex: "status",
      key: "status",
      width: 120,
      render: (value: CustomerVoucher["status"]) =>
        value === "active" ? (
          <Tag color="success">Có thể dùng</Tag>
        ) : (
          <Tag>{value}</Tag>
        ),
    },
    {
      title: "Hạn dùng",
      dataIndex: "expires_at",
      key: "expires_at",
      width: 180,
      render: (value: string | null) =>
        value ? new Date(value).toLocaleString("vi-VN") : "Không giới hạn",
    },
  ];

  return (
    <div>
      {contextHolder}
      <Space direction="vertical" size={16} style={{ width: "100%" }}>
        <div>
          <Typography.Title level={2} style={{ marginBottom: 4 }}>
            Ví điểm khách hàng
          </Typography.Title>
          <Typography.Text type="secondary">
            Tra cứu điểm, lịch sử tích/đổi điểm và voucher của từng khách hàng.
          </Typography.Text>
        </div>

        <Card>
          <Form
            form={form}
            layout="inline"
            onFinish={(values) => loadWallet(values.phone)}
          >
            <Form.Item
              name="phone"
              rules={[{ required: true, message: "Nhập SĐT" }]}
              style={{ minWidth: 280 }}
            >
              <Input placeholder="Nhập số điện thoại khách hàng" />
            </Form.Item>
            <Button
              type="primary"
              htmlType="submit"
              icon={<SearchOutlined />}
              loading={loading}
            >
              Tra cứu
            </Button>
          </Form>
        </Card>

        {!data ? (
          <Card>
            <Empty description="Nhập số điện thoại để xem ví điểm khách hàng" />
          </Card>
        ) : (
          <>
            <Row gutter={[16, 16]}>
              <Col xs={24} sm={8}>
                <Card>
                  <Statistic
                    title="Điểm hiện tại"
                    value={data.wallet.total_points}
                  />
                </Card>
              </Col>
              <Col xs={24} sm={8}>
                <Card>
                  <Statistic
                    title="Tổng điểm đã tích"
                    value={data.wallet.lifetime_earned_points}
                  />
                </Card>
              </Col>
              <Col xs={24} sm={8}>
                <Card>
                  <Statistic
                    title="Tổng điểm đã đổi"
                    value={data.wallet.lifetime_redeemed_points}
                  />
                </Card>
              </Col>
            </Row>

            <Card
              title={`Voucher của ${normalizedPhone}`}
              extra={
                <Button
                  type="primary"
                  icon={<GiftOutlined />}
                  disabled={data.redeemCampaigns.length === 0}
                  onClick={() => setRedeemModalOpen(true)}
                >
                  Đổi điểm lấy voucher
                </Button>
              }
            >
              {data.redeemCampaigns.length === 0 && (
                <Alert
                  type="info"
                  showIcon
                  style={{ marginBottom: 12 }}
                  message="Chưa có chiến dịch đổi điểm lấy voucher đang bật."
                />
              )}
              <Table
                rowKey="id"
                columns={voucherColumns}
                dataSource={data.vouchers}
                pagination={{ pageSize: 5 }}
              />
            </Card>

            <Card title="Lịch sử điểm">
              <Table
                rowKey="id"
                columns={transactionColumns}
                dataSource={data.transactions}
                pagination={{ pageSize: 8 }}
              />
            </Card>
          </>
        )}
      </Space>

      <Modal
        title="Đổi điểm lấy voucher"
        open={redeemModalOpen}
        onCancel={() => !redeeming && setRedeemModalOpen(false)}
        onOk={() => redeemForm.submit()}
        okText="Đổi điểm"
        cancelText="Hủy"
        confirmLoading={redeeming}
        destroyOnHidden
      >
        <Form form={redeemForm} layout="vertical" onFinish={handleRedeem}>
          <Form.Item
            name="campaignId"
            label="Chọn chiến dịch đổi điểm"
            rules={[{ required: true, message: "Vui lòng chọn chiến dịch" }]}
          >
            <Select
              options={(data?.redeemCampaigns || []).map((campaign) => ({
                value: campaign.id,
                label: `${campaign.campaign_name} - ${Number(campaign.config?.pointsCost || 0).toLocaleString("vi-VN")} điểm`,
              }))}
            />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
