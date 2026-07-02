"use client";

import { useCallback, useEffect, useState } from "react";
import type { Dayjs } from "dayjs";
import dayjs from "dayjs";
import {
  Alert,
  Button,
  Card,
  Checkbox,
  DatePicker,
  Form,
  Input,
  InputNumber,
  Modal,
  Popconfirm,
  Select,
  Space,
  Table,
  Tag,
  Typography,
  message,
} from "antd";
import {
  DeleteOutlined,
  EditOutlined,
  PlusOutlined,
  ReloadOutlined,
  SearchOutlined,
} from "@ant-design/icons";
import type {
  FinancialPaymentChannel,
  FinancialTransaction,
  FinancialTransactionType,
} from "@/types/tax-readiness";

const { Title, Text } = Typography;
const { RangePicker } = DatePicker;
const moneyFormatter = new Intl.NumberFormat("vi-VN", {
  maximumFractionDigits: 0,
});

interface TransactionFormValues {
  transactionType: FinancialTransactionType;
  paymentChannel: FinancialPaymentChannel;
  occurredAt: Dayjs;
  documentNumber: string;
  category: string;
  description: string;
  amount: number;
  counterparty: string;
  affectsTaxRevenue: boolean;
  notes: string;
}

const categoryOptions = [
  "Bán hàng ngoài hệ thống",
  "Nhập hàng",
  "Chi phí vận hành",
  "Thuê mặt bằng",
  "Lương và nhân công",
  "Vận chuyển",
  "Thu nhập khác",
  "Chi phí khác",
].map((value) => ({ value, label: value }));

async function readResponse(response: Response) {
  const result = await response.json();
  if (!response.ok) throw new Error(result.error || "Thao tác không thành công");
  return result;
}

export default function FinancialTransactionsPage() {
  const [messageApi, contextHolder] = message.useMessage();
  const [form] = Form.useForm<TransactionFormValues>();
  const [transactions, setTransactions] = useState<FinancialTransaction[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editing, setEditing] = useState<FinancialTransaction | null>(null);
  const [search, setSearch] = useState("");
  const [type, setType] = useState<string>("all");
  const [channel, setChannel] = useState<string>("all");
  const [dateRange, setDateRange] = useState<[Dayjs, Dayjs]>([
    dayjs().startOf("year"),
    dayjs().endOf("year"),
  ]);
  const [pagination, setPagination] = useState({
    page: 1,
    pageSize: 20,
    total: 0,
  });

  const fetchTransactions = useCallback(
    async (targetPage = pagination.page, targetPageSize = pagination.pageSize) => {
      setIsLoading(true);
      try {
        const params = new URLSearchParams({
          page: String(targetPage),
          pageSize: String(targetPageSize),
          from: dateRange[0].format("YYYY-MM-DD"),
          to: dateRange[1].format("YYYY-MM-DD"),
        });
        if (search.trim()) params.set("search", search.trim());
        if (type !== "all") params.set("type", type);
        if (channel !== "all") params.set("channel", channel);

        const result = await readResponse(
          await fetch(`/api/admin/financial-transactions?${params}`, {
            cache: "no-store",
          }),
        );
        setTransactions(result.transactions || []);
        setPagination(result.pagination);
      } catch (error) {
        messageApi.error(
          error instanceof Error ? error.message : "Không thể tải sổ thu–chi",
        );
      } finally {
        setIsLoading(false);
      }
    },
    [
      channel,
      dateRange,
      messageApi,
      pagination.page,
      pagination.pageSize,
      search,
      type,
    ],
  );

  useEffect(() => {
    fetchTransactions(1, pagination.pageSize);
    // Filters are applied explicitly with the Search button.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const openCreate = () => {
    setEditing(null);
    form.setFieldsValue({
      transactionType: "expense",
      paymentChannel: "bank",
      occurredAt: dayjs(),
      documentNumber: "",
      category: "Nhập hàng",
      description: "",
      amount: 0,
      counterparty: "",
      affectsTaxRevenue: false,
      notes: "",
    });
    setIsModalOpen(true);
  };

  const openEdit = (transaction: FinancialTransaction) => {
    setEditing(transaction);
    form.setFieldsValue({
      ...transaction,
      occurredAt: dayjs(transaction.occurredAt),
    });
    setIsModalOpen(true);
  };

  const saveTransaction = async (values: TransactionFormValues) => {
    setIsSaving(true);
    try {
      const response = await fetch("/api/admin/financial-transactions", {
        method: editing ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...values,
          id: editing?.id,
          occurredAt: values.occurredAt.format("YYYY-MM-DD"),
        }),
      });
      await readResponse(response);
      messageApi.success(editing ? "Đã cập nhật giao dịch" : "Đã thêm giao dịch");
      setIsModalOpen(false);
      await fetchTransactions(1, pagination.pageSize);
    } catch (error) {
      messageApi.error(
        error instanceof Error ? error.message : "Không thể lưu giao dịch",
      );
    } finally {
      setIsSaving(false);
    }
  };

  const deleteTransaction = async (id: string) => {
    try {
      await readResponse(
        await fetch(`/api/admin/financial-transactions?id=${id}`, {
          method: "DELETE",
        }),
      );
      messageApi.success("Đã xóa giao dịch");
      await fetchTransactions(1, pagination.pageSize);
    } catch (error) {
      messageApi.error(
        error instanceof Error ? error.message : "Không thể xóa giao dịch",
      );
    }
  };

  const watchedType = Form.useWatch("transactionType", form);

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
            Sổ thu–chi dự phòng
          </Title>
          <Text type="secondary">
            Ghi nhận dòng tiền mặt/ngân hàng để sẵn sàng cho S2c, S2e khi cần
          </Text>
        </div>
        <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>
          Thêm giao dịch
        </Button>
      </Space>

      <Alert
        type="info"
        showIcon
        style={{ marginBottom: 16 }}
        message="Đơn hàng đã hoàn thành được hệ thống tự tính riêng."
        description="Không nhập lại doanh thu của đơn hàng tại đây. Chỉ bật “Cộng vào doanh thu tính thuế” cho khoản thu bên ngoài hệ thống để tránh cộng hai lần."
      />

      <Card style={{ marginBottom: 16 }}>
        <Space wrap>
          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            onPressEnter={() => fetchTransactions(1, pagination.pageSize)}
            prefix={<SearchOutlined />}
            placeholder="Tìm diễn giải, đối tác, chứng từ"
            allowClear
            style={{ width: 280 }}
          />
          <Select
            value={type}
            onChange={setType}
            style={{ width: 150 }}
            options={[
              { value: "all", label: "Tất cả thu/chi" },
              { value: "income", label: "Khoản thu" },
              { value: "expense", label: "Khoản chi" },
            ]}
          />
          <Select
            value={channel}
            onChange={setChannel}
            style={{ width: 160 }}
            options={[
              { value: "all", label: "Mọi kênh" },
              { value: "cash", label: "Tiền mặt" },
              { value: "bank", label: "Ngân hàng" },
            ]}
          />
          <RangePicker
            value={dateRange}
            format="DD/MM/YYYY"
            onChange={(value) => {
              if (value?.[0] && value?.[1]) {
                setDateRange([value[0], value[1]]);
              }
            }}
          />
          <Button
            type="primary"
            icon={<SearchOutlined />}
            onClick={() => fetchTransactions(1, pagination.pageSize)}
          >
            Lọc
          </Button>
          <Button
            icon={<ReloadOutlined />}
            onClick={() => fetchTransactions()}
          >
            Làm mới
          </Button>
        </Space>
      </Card>

      <Card>
        <Table
          rowKey="id"
          loading={isLoading}
          dataSource={transactions}
          scroll={{ x: 1050 }}
          pagination={{
            current: pagination.page,
            pageSize: pagination.pageSize,
            total: pagination.total,
            showSizeChanger: true,
            showTotal: (total) => `Tổng ${total} giao dịch`,
            onChange: (page, pageSize) => fetchTransactions(page, pageSize),
          }}
          columns={[
            {
              title: "Ngày",
              dataIndex: "occurredAt",
              width: 110,
              render: (value: string) => dayjs(value).format("DD/MM/YYYY"),
            },
            {
              title: "Loại",
              dataIndex: "transactionType",
              width: 100,
              render: (value: FinancialTransactionType) => (
                <Tag color={value === "income" ? "green" : "volcano"}>
                  {value === "income" ? "Thu" : "Chi"}
                </Tag>
              ),
            },
            {
              title: "Kênh",
              dataIndex: "paymentChannel",
              width: 110,
              render: (value: FinancialPaymentChannel) =>
                value === "cash" ? "Tiền mặt" : "Ngân hàng",
            },
            { title: "Danh mục", dataIndex: "category", width: 170 },
            {
              title: "Diễn giải",
              dataIndex: "description",
              ellipsis: true,
              width: 260,
            },
            {
              title: "Số tiền",
              dataIndex: "amount",
              align: "right",
              width: 150,
              render: (value: number, row: FinancialTransaction) => (
                <Text
                  strong
                  type={row.transactionType === "income" ? "success" : "danger"}
                >
                  {row.transactionType === "income" ? "+" : "−"}
                  {moneyFormatter.format(value)} đ
                </Text>
              ),
            },
            {
              title: "Tính doanh thu",
              dataIndex: "affectsTaxRevenue",
              align: "center",
              width: 130,
              render: (value: boolean) =>
                value ? <Tag color="blue">Có</Tag> : "—",
            },
            {
              title: "Thao tác",
              key: "actions",
              fixed: "right",
              width: 100,
              render: (_: unknown, row: FinancialTransaction) => (
                <Space>
                  <Button
                    type="text"
                    icon={<EditOutlined />}
                    onClick={() => openEdit(row)}
                  />
                  <Popconfirm
                    title="Xóa giao dịch này?"
                    description="Thao tác không thể hoàn tác."
                    okText="Xóa"
                    cancelText="Hủy"
                    okButtonProps={{ danger: true }}
                    onConfirm={() => deleteTransaction(row.id)}
                  >
                    <Button danger type="text" icon={<DeleteOutlined />} />
                  </Popconfirm>
                </Space>
              ),
            },
          ]}
        />
      </Card>

      <Modal
        title={editing ? "Chỉnh sửa giao dịch" : "Thêm giao dịch"}
        open={isModalOpen}
        onCancel={() => setIsModalOpen(false)}
        onOk={() => form.submit()}
        confirmLoading={isSaving}
        okText="Lưu"
        cancelText="Hủy"
        width={680}
        destroyOnHidden
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={saveTransaction}
          style={{ marginTop: 20 }}
        >
          <Space size={16} align="start" style={{ width: "100%" }}>
            <Form.Item
              name="transactionType"
              label="Loại giao dịch"
              rules={[{ required: true }]}
              style={{ width: 200 }}
            >
              <Select
                options={[
                  { value: "income", label: "Khoản thu" },
                  { value: "expense", label: "Khoản chi" },
                ]}
              />
            </Form.Item>
            <Form.Item
              name="paymentChannel"
              label="Kênh thanh toán"
              rules={[{ required: true }]}
              style={{ width: 200 }}
            >
              <Select
                options={[
                  { value: "cash", label: "Tiền mặt" },
                  { value: "bank", label: "Ngân hàng" },
                ]}
              />
            </Form.Item>
            <Form.Item
              name="occurredAt"
              label="Ngày"
              rules={[{ required: true }]}
              style={{ flex: 1 }}
            >
              <DatePicker format="DD/MM/YYYY" style={{ width: "100%" }} />
            </Form.Item>
          </Space>
          <Space size={16} align="start" style={{ width: "100%" }}>
            <Form.Item
              name="category"
              label="Danh mục"
              rules={[{ required: true, message: "Chọn hoặc nhập danh mục" }]}
              style={{ flex: 1 }}
            >
              <Select
                showSearch
                options={categoryOptions}
                placeholder="Chọn danh mục"
              />
            </Form.Item>
            <Form.Item
              name="amount"
              label="Số tiền (đồng)"
              rules={[
                { required: true, message: "Nhập số tiền" },
                {
                  type: "number",
                  min: 1,
                  message: "Số tiền phải lớn hơn 0",
                },
              ]}
              style={{ width: 260 }}
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
          </Space>
          <Form.Item
            name="description"
            label="Diễn giải"
            rules={[{ required: true, message: "Nhập diễn giải" }]}
          >
            <Input placeholder="Ví dụ: Mua lô sản phẩm dinh dưỡng..." />
          </Form.Item>
          <Space size={16} align="start" style={{ width: "100%" }}>
            <Form.Item
              name="counterparty"
              label="Đối tác/khách hàng"
              style={{ flex: 1 }}
            >
              <Input />
            </Form.Item>
            <Form.Item
              name="documentNumber"
              label="Số chứng từ"
              style={{ flex: 1 }}
            >
              <Input />
            </Form.Item>
          </Space>
          {watchedType === "income" && (
            <Form.Item name="affectsTaxRevenue" valuePropName="checked">
              <Checkbox>
                Cộng khoản này vào doanh thu theo dõi ngưỡng thuế
              </Checkbox>
            </Form.Item>
          )}
          <Form.Item name="notes" label="Ghi chú">
            <Input.TextArea rows={3} maxLength={1000} showCount />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
