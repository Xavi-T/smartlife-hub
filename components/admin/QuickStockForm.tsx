"use client";

import { useEffect, useState } from "react";
import { Card, Form, Select, InputNumber, Button, message, Alert } from "antd";
import { InboxOutlined } from "@ant-design/icons";
import type { Product } from "@/types/database";
import { formatCurrency } from "@/lib/utils";

interface QuickStockFormProps {
  products: Product[];
  onStockUpdated: () => void;
}

export function QuickStockForm({
  products,
  onStockUpdated,
}: QuickStockFormProps) {
  const [form] = Form.useForm();
  const [messageApi, contextHolder] = message.useMessage();
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Watch selected product
  const selectedProductId = Form.useWatch("productId", form);
  const selectedProduct = products.find((p) => p.id === selectedProductId);

  // Set default cost price when product changes
  useEffect(() => {
    if (selectedProduct) {
      form.setFieldValue("costPriceAtTime", selectedProduct.cost_price);
    }
  }, [selectedProduct, form]);

  const handleSubmit = async (values: {
    productId: string;
    quantityAdded: number;
    costPriceAtTime: number;
  }) => {
    setIsSubmitting(true);

    try {
      const response = await fetch("/api/admin/stock-inbound", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          productId: values.productId,
          quantityAdded: values.quantityAdded,
          costPriceAtTime: values.costPriceAtTime,
          supplier: null,
          notes: "Nhập nhanh từ Dashboard",
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to update stock");
      }

      const result = await response.json();

      messageApi.success(
        `Đã nhập ${values.quantityAdded} ${selectedProduct?.name}. Tồn kho mới: ${result.data.new_stock_quantity}`,
      );

      // Reset form
      form.resetFields();

      // Refresh data
      onStockUpdated();
    } catch (error: unknown) {
      console.error("Error updating stock:", error);
      const errorMessage =
        error instanceof Error ? error.message : "Có lỗi xảy ra khi nhập hàng";
      messageApi.error(errorMessage);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      {contextHolder}
      <Card
        title={
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <InboxOutlined style={{ fontSize: 20, color: "#1890ff" }} />
            <span>Nhập hàng nhanh</span>
          </div>
        }
      >
        <Alert
          title="Nhập hàng đầy đủ"
          description="Để nhập hàng với đầy đủ thông tin (nhà cung cấp, ghi chú), vui lòng vào trang Quản lý Kho."
          type="info"
          showIcon
          style={{ marginBottom: 16 }}
        />

        <Form
          form={form}
          layout="vertical"
          onFinish={handleSubmit}
          autoComplete="off"
          disabled={isSubmitting}
        >
          <Form.Item
            name="productId"
            label="Chọn sản phẩm"
            rules={[{ required: true, message: "Vui lòng chọn sản phẩm" }]}
          >
            <Select
              placeholder="-- Chọn sản phẩm --"
              showSearch
              optionFilterProp="children"
              filterOption={(input, option) =>
                (option?.label ?? "")
                  .toLowerCase()
                  .includes(input.toLowerCase())
              }
              options={products
                .filter((p) => p.is_active)
                .map((product) => ({
                  value: product.id,
                  label: `${product.name} (Tồn: ${product.stock_quantity})`,
                }))}
            />
          </Form.Item>

          {selectedProduct && (
            <Card
              size="small"
              style={{ marginBottom: 16, background: "#fafafa" }}
            >
              <div style={{ fontSize: 12, color: "#8c8c8c", marginBottom: 4 }}>
                Giá vốn hiện tại
              </div>
              <div style={{ fontSize: 16, fontWeight: 600 }}>
                {formatCurrency(selectedProduct.cost_price)}
              </div>
            </Card>
          )}

          <Form.Item
            name="quantityAdded"
            label="Số lượng nhập thêm"
            rules={[
              { required: true, message: "Vui lòng nhập số lượng" },
              { type: "number", min: 1, message: "Số lượng phải lớn hơn 0" },
            ]}
          >
            <InputNumber
              placeholder="Nhập số lượng..."
              style={{ width: "100%" }}
              min={1}
            />
          </Form.Item>

          <Form.Item
            name="costPriceAtTime"
            label="Giá vốn lô hàng này (VNĐ)"
            rules={[
              { required: true, message: "Vui lòng nhập giá vốn" },
              {
                type: "number",
                min: 0,
                message: "Giá vốn phải lớn hơn hoặc bằng 0",
              },
            ]}
            tooltip="Giá vốn của lô hàng đang nhập. Hệ thống sẽ tính giá vốn bình quân gia quyền."
          >
            <InputNumber
              placeholder="Nhập giá vốn..."
              style={{ width: "100%" }}
              min={0}
              formatter={(value) =>
                `${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ",")
              }
              parser={(value) => value!.replace(/\$\s?|(,*)/g, "")}
            />
          </Form.Item>

          <Form.Item>
            <Button
              type="primary"
              htmlType="submit"
              icon={<InboxOutlined />}
              loading={isSubmitting}
              block
            >
              Nhập hàng
            </Button>
          </Form.Item>
        </Form>
      </Card>
    </>
  );
}
