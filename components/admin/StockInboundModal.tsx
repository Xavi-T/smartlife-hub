"use client";

import { useState, useEffect } from "react";
import {
  Modal,
  Form,
  Select,
  Radio,
  InputNumber,
  Input,
  Card,
  Statistic,
  Row,
  Col,
  Button,
  message,
} from "antd";
import {
  InboxOutlined,
  DollarOutlined,
  TruckOutlined,
  FileTextOutlined,
  CalculatorOutlined,
} from "@ant-design/icons";
import { formatCurrency } from "@/lib/utils";
import type { Product } from "@/types/database";

const { TextArea } = Input;

interface StockInboundModalProps {
  isOpen: boolean;
  onClose: () => void;
  product?: Product | null;
  onSuccess?: () => void;
}

type CostingMethod = "weighted_average" | "latest_cost";

export function StockInboundModal({
  isOpen,
  onClose,
  product: initialProduct,
  onSuccess,
}: StockInboundModalProps) {
  const [form] = Form.useForm();
  const [messageApi, contextHolder] = message.useMessage();
  const [products, setProducts] = useState<Product[]>([]);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(
    initialProduct || null,
  );
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Watch form values for preview calculation
  const quantityAdded = Form.useWatch("quantityAdded", form);
  const costPriceAtTime = Form.useWatch("costPriceAtTime", form);
  const costingMethod =
    (Form.useWatch("costingMethod", form) as CostingMethod | undefined) ||
    "weighted_average";

  useEffect(() => {
    if (isOpen && !initialProduct) {
      fetchProducts();
    }
  }, [isOpen, initialProduct]);

  useEffect(() => {
    if (initialProduct) {
      setSelectedProduct(initialProduct);
      form.setFieldsValue({
        costPriceAtTime: initialProduct.cost_price,
        costingMethod: "weighted_average",
      });
    }
  }, [initialProduct, form]);

  const fetchProducts = async () => {
    try {
      const res = await fetch("/api/products");
      if (res.ok) {
        const data = await res.json();
        setProducts(data);
      }
    } catch (error) {
      console.error("Error fetching products:", error);
    }
  };

  const handleProductChange = (productId: string) => {
    const product = products.find((p) => p.id === productId);
    setSelectedProduct(product || null);
    if (product) {
      form.setFieldValue("costPriceAtTime", product.cost_price);
      form.setFieldValue("costingMethod", "weighted_average");
    }
  };

  const handleSubmit = async (values: any) => {
    if (!selectedProduct) {
      messageApi.error("Vui lòng chọn sản phẩm");
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await fetch("/api/admin/stock-inbound", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          productId: selectedProduct.id,
          quantityAdded: values.quantityAdded,
          costPriceAtTime: values.costPriceAtTime,
          costingMethod: values.costingMethod || "weighted_average",
          supplier: values.supplier?.trim() || null,
          notes: values.notes?.trim() || null,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Không thể nhập hàng");
      }

      messageApi.success(
        `Đã nhập ${values.quantityAdded} ${selectedProduct.name}. Tồn kho mới: ${result.data.new_stock_quantity}. Giá vốn mới: ${formatCurrency(result.data.new_cost_price ?? result.data.new_weighted_avg_cost ?? values.costPriceAtTime)}`,
      );

      // Reset form
      form.resetFields();
      setSelectedProduct(null);

      if (onSuccess) onSuccess();
      onClose();
    } catch (error: any) {
      messageApi.error(error.message || "Đã xảy ra lỗi khi nhập hàng");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    if (!isSubmitting) {
      form.resetFields();
      setSelectedProduct(null);
      onClose();
    }
  };

  // Calculate preview
  const calculatePreviewAvgCost = () => {
    if (!selectedProduct || !quantityAdded || !costPriceAtTime) return null;

    const qty = quantityAdded;
    const cost = costPriceAtTime;

    if (qty <= 0 || cost < 0) return null;

    const currentQty = selectedProduct.stock_quantity || 0;
    const currentCost = selectedProduct.cost_price || 0;

    if (currentQty === 0 || costingMethod === "latest_cost") return cost;

    const newAvgCost =
      (currentQty * currentCost + qty * cost) / (currentQty + qty);
    return newAvgCost;
  };

  const previewAvgCost = calculatePreviewAvgCost();
  const totalValue = (quantityAdded || 0) * (costPriceAtTime || 0);

  return (
    <>
      {contextHolder}
      <Modal
        title={
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <InboxOutlined style={{ fontSize: 20 }} />
            <div>
              <div>Nhập hàng vào kho</div>
              <div
                style={{ fontSize: 12, fontWeight: "normal", color: "#8c8c8c" }}
              >
                Ghi nhận lô hàng mới
              </div>
            </div>
          </div>
        }
        open={isOpen}
        onCancel={handleClose}
        width={700}
        footer={null}
        destroyOnHidden
      >
        {/* Product Info or Selection */}
        {selectedProduct ? (
          <Card
            size="small"
            style={{ marginBottom: 16, backgroundColor: "#f5f5f5" }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
              {selectedProduct.image_url ? (
                <img
                  src={selectedProduct.image_url}
                  alt={selectedProduct.name}
                  style={{
                    width: 64,
                    height: 64,
                    objectFit: "cover",
                    borderRadius: 8,
                  }}
                />
              ) : (
                <div
                  style={{
                    width: 64,
                    height: 64,
                    backgroundColor: "#e0e0e0",
                    borderRadius: 8,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: 32,
                  }}
                >
                  📦
                </div>
              )}
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 600, fontSize: 16 }}>
                  {selectedProduct.name}
                </div>
                <div style={{ fontSize: 14, color: "#8c8c8c", marginTop: 4 }}>
                  Tồn kho: <strong>{selectedProduct.stock_quantity}</strong> ·
                  Giá vốn:{" "}
                  <strong>{formatCurrency(selectedProduct.cost_price)}</strong>
                </div>
              </div>
            </div>
          </Card>
        ) : null}

        <Form
          form={form}
          layout="vertical"
          onFinish={handleSubmit}
          autoComplete="off"
        >
          {!initialProduct && (
            <Form.Item
              name="productId"
              label="Chọn sản phẩm"
              rules={[{ required: true, message: "Vui lòng chọn sản phẩm" }]}
            >
              <Select
                placeholder="-- Chọn sản phẩm --"
                showSearch
                optionFilterProp="children"
                onChange={handleProductChange}
                options={products.map((p) => ({
                  value: p.id,
                  label: `${p.name} (Tồn: ${p.stock_quantity})`,
                }))}
              />
            </Form.Item>
          )}

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                name="quantityAdded"
                label={
                  <>
                    <InboxOutlined /> Số lượng nhập
                  </>
                }
                rules={[
                  { required: true, message: "Vui lòng nhập số lượng" },
                  {
                    type: "number",
                    min: 1,
                    message: "Số lượng phải lớn hơn 0",
                  },
                ]}
              >
                <InputNumber
                  placeholder="Nhập số lượng"
                  style={{ width: "100%" }}
                  min={1}
                />
              </Form.Item>
            </Col>

            <Col span={12}>
              <Form.Item
                name="costPriceAtTime"
                label={
                  <>
                    <DollarOutlined /> Giá vốn/sản phẩm
                  </>
                }
                rules={[
                  { required: true, message: "Vui lòng nhập giá vốn" },
                  { type: "number", min: 0, message: "Giá vốn không được âm" },
                ]}
              >
                <InputNumber
                  placeholder="Nhập giá vốn"
                  style={{ width: "100%" }}
                  min={0}
                  formatter={(value) =>
                    `${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ",")
                  }
                />
              </Form.Item>
            </Col>
          </Row>

          <Form.Item
            name="costingMethod"
            label="Phương pháp tính giá vốn sau nhập"
            initialValue="weighted_average"
          >
            <Radio.Group>
              <Radio value="weighted_average">Bình quân gia quyền</Radio>
              <Radio value="latest_cost" style={{ marginLeft: 16 }}>
                Lấy giá nhập mới nhất
              </Radio>
            </Radio.Group>
          </Form.Item>

          <Form.Item
            name="supplier"
            label={
              <>
                <TruckOutlined /> Nhà cung cấp
              </>
            }
          >
            <Input placeholder="Tên nhà cung cấp (không bắt buộc)" />
          </Form.Item>

          <Form.Item
            name="notes"
            label={
              <>
                <FileTextOutlined /> Ghi chú
              </>
            }
          >
            <TextArea
              rows={3}
              placeholder="Ghi chú về lô hàng (không bắt buộc)"
            />
          </Form.Item>

          {/* Preview Calculation */}
          {previewAvgCost !== null && selectedProduct && (
            <Card
              size="small"
              style={{
                marginBottom: 16,
                backgroundColor: "#e6f7ff",
                borderColor: "#91d5ff",
              }}
              title={
                <div style={{ fontSize: 14 }}>
                  <CalculatorOutlined /> Dự tính sau khi nhập
                </div>
              }
            >
              <Row gutter={16}>
                <Col span={8}>
                  <Statistic
                    title="Tồn kho mới"
                    value={
                      (selectedProduct.stock_quantity || 0) +
                      (quantityAdded || 0)
                    }
                    style={{ fontSize: 20, color: "#1890ff" }}
                  />
                </Col>
                <Col span={8}>
                  <Statistic
                    title={
                      costingMethod === "latest_cost"
                        ? "Giá vốn mới"
                        : "Giá vốn BQ mới"
                    }
                    value={formatCurrency(previewAvgCost)}
                    style={{ fontSize: 20, color: "#1890ff" }}
                  />
                </Col>
                <Col span={8}>
                  <Statistic
                    title="Tổng giá trị nhập"
                    value={formatCurrency(totalValue)}
                    style={{ fontSize: 20, color: "#52c41a" }}
                  />
                </Col>
              </Row>
            </Card>
          )}

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
              icon={<InboxOutlined />}
            >
              Xác nhận nhập hàng
            </Button>
          </Form.Item>
        </Form>
      </Modal>
    </>
  );
}
