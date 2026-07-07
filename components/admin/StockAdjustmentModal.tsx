"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Alert,
  Button,
  Card,
  Col,
  Form,
  Image,
  Input,
  InputNumber,
  Modal,
  Row,
  Space,
  Statistic,
  Typography,
  message,
} from "antd";
import {
  EditOutlined,
  FileTextOutlined,
  InboxOutlined,
} from "@ant-design/icons";
import { formatNumber } from "@/lib/utils";
import type { Product } from "@/types/database";

const { TextArea } = Input;

interface StockAdjustmentModalProps {
  isOpen: boolean;
  product?: Product | null;
  onClose: () => void;
  onSuccess?: () => void;
}

interface StockAdjustmentFormValues {
  newStockQuantity: number;
  reason: string;
}

export function StockAdjustmentModal({
  isOpen,
  product,
  onClose,
  onSuccess,
}: StockAdjustmentModalProps) {
  const [form] = Form.useForm<StockAdjustmentFormValues>();
  const [messageApi, contextHolder] = message.useMessage();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const newStockQuantity = Form.useWatch("newStockQuantity", form);

  useEffect(() => {
    if (!isOpen || !product) return;

    form.setFieldsValue({
      newStockQuantity: product.stock_quantity,
      reason: "",
    });
  }, [form, isOpen, product]);

  const stockDelta = useMemo(() => {
    if (!product || !Number.isFinite(Number(newStockQuantity))) return 0;
    return Number(newStockQuantity) - Number(product.stock_quantity || 0);
  }, [newStockQuantity, product]);

  const handleClose = () => {
    if (isSubmitting) return;
    form.resetFields();
    onClose();
  };

  const handleSubmit = async (values: StockAdjustmentFormValues) => {
    if (!product) {
      messageApi.error("Vui lòng chọn sản phẩm");
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await fetch("/api/admin/inventory/adjust-stock", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        cache: "no-store",
        body: JSON.stringify({
          productId: product.id,
          expectedStockQuantity: product.stock_quantity,
          newStockQuantity: values.newStockQuantity,
          reason: values.reason?.trim(),
        }),
      });

      const result = await response.json();
      if (!response.ok) {
        if (response.status === 409) onSuccess?.();
        throw new Error(result.error || "Không thể điều chỉnh tồn kho");
      }

      messageApi.success(
        `Đã cập nhật tồn kho ${product.name}: ${formatNumber(product.stock_quantity)} → ${formatNumber(values.newStockQuantity)}`,
      );
      form.resetFields();
      onSuccess?.();
      onClose();
    } catch (error: unknown) {
      messageApi.error(
        error instanceof Error
          ? error.message
          : "Đã xảy ra lỗi khi điều chỉnh tồn kho",
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      {contextHolder}
      <Modal
        title={
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <EditOutlined style={{ fontSize: 20 }} />
            <div>
              <div>Chỉnh sửa tồn kho</div>
              <div
                style={{ fontSize: 12, fontWeight: "normal", color: "#8c8c8c" }}
              >
                Điều chỉnh số lượng hiện có trong kho
              </div>
            </div>
          </div>
        }
        open={isOpen}
        onCancel={handleClose}
        footer={null}
        destroyOnHidden
        width={640}
      >
        {product ? (
          <>
            <Card
              size="small"
              style={{ marginBottom: 16, backgroundColor: "#f5f5f5" }}
            >
              <Space align="center" size={16}>
                {product.image_url ? (
                  <Image
                    src={product.image_url}
                    alt={product.name}
                    width={64}
                    height={64}
                    preview={false}
                    style={{ objectFit: "cover", borderRadius: 8 }}
                  />
                ) : (
                  <div
                    style={{
                      width: 64,
                      height: 64,
                      backgroundColor: "#e0e0e0",
                      borderRadius: 8,
                      display: "grid",
                      placeItems: "center",
                      fontSize: 32,
                    }}
                  >
                    📦
                  </div>
                )}
                <div>
                  <Typography.Text strong style={{ fontSize: 16 }}>
                    {product.name}
                  </Typography.Text>
                  <div style={{ marginTop: 4 }}>
                    <Typography.Text type="secondary">
                      {product.category}
                    </Typography.Text>
                  </div>
                </div>
              </Space>
            </Card>

            <Form
              form={form}
              layout="vertical"
              onFinish={handleSubmit}
              autoComplete="off"
            >
              <Row gutter={16}>
                <Col xs={24} md={8}>
                  <Statistic
                    title="Tồn hiện tại"
                    value={formatNumber(product.stock_quantity)}
                  />
                </Col>
                <Col xs={24} md={8}>
                  <Statistic
                    title="Tồn mới"
                    value={formatNumber(Number(newStockQuantity || 0))}
                    valueStyle={{ color: "#1677ff" }}
                  />
                </Col>
                <Col xs={24} md={8}>
                  <Statistic
                    title="Chênh lệch"
                    value={`${stockDelta > 0 ? "+" : ""}${formatNumber(stockDelta)}`}
                    valueStyle={{
                      color:
                        stockDelta > 0
                          ? "#52c41a"
                          : stockDelta < 0
                            ? "#ff4d4f"
                            : undefined,
                    }}
                  />
                </Col>
              </Row>

              <Form.Item
                name="newStockQuantity"
                label={
                  <>
                    <InboxOutlined /> Số lượng tồn kho mới
                  </>
                }
                style={{ marginTop: 16 }}
                rules={[
                  { required: true, message: "Vui lòng nhập tồn kho mới" },
                  {
                    type: "number",
                    min: 0,
                    message: "Tồn kho không được âm",
                  },
                  {
                    validator: (_, value) => {
                      if (Number.isInteger(Number(value))) {
                        return Promise.resolve();
                      }
                      return Promise.reject(
                        new Error("Tồn kho phải là số nguyên"),
                      );
                    },
                  },
                ]}
              >
                <InputNumber<number>
                  min={0}
                  precision={0}
                  style={{ width: "100%" }}
                  placeholder="Ví dụ: 25"
                  formatter={(value) =>
                    `${value ?? ""}`.replace(/\B(?=(\d{3})+(?!\d))/g, ".")
                  }
                  parser={(value) =>
                    Number(String(value || "").replace(/\./g, "")) || 0
                  }
                />
              </Form.Item>

              <Form.Item
                name="reason"
                label={
                  <>
                    <FileTextOutlined /> Lý do điều chỉnh
                  </>
                }
                rules={[
                  { required: true, message: "Vui lòng nhập lý do điều chỉnh" },
                  { min: 3, message: "Lý do cần ít nhất 3 ký tự" },
                ]}
              >
                <TextArea
                  rows={3}
                  placeholder="Ví dụ: Kiểm kê kho thực tế, hàng hỏng, nhập sai số lượng..."
                />
              </Form.Item>

              <Alert
                showIcon
                type="info"
                style={{ marginBottom: 16 }}
                message="Lưu ý"
                description="Chức năng này dùng để điều chỉnh tồn kho thực tế. Nếu là nhập lô hàng mới có giá vốn, nên dùng nút Nhập hàng để hệ thống ghi nhận giá vốn và lịch sử nhập."
              />

              <Form.Item style={{ marginBottom: 0, textAlign: "right" }}>
                <Button
                  onClick={handleClose}
                  disabled={isSubmitting}
                  style={{ marginRight: 8 }}
                >
                  Hủy
                </Button>
                <Button
                  type="primary"
                  htmlType="submit"
                  loading={isSubmitting}
                  icon={<EditOutlined />}
                >
                  Lưu tồn kho
                </Button>
              </Form.Item>
            </Form>
          </>
        ) : (
          <Alert
            showIcon
            type="warning"
            message="Chưa chọn sản phẩm"
            description="Vui lòng đóng modal và chọn lại sản phẩm cần chỉnh tồn kho."
          />
        )}
      </Modal>
    </>
  );
}
