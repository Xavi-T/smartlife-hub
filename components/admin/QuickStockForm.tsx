"use client";

import { Card, Form, Select, InputNumber, Button, message } from "antd";
import { InboxOutlined } from "@ant-design/icons";
import type { Product } from "@/types/database";

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

  const handleSubmit = async (values: {
    productId: string;
    quantity: number;
  }) => {
    try {
      const response = await fetch("/api/products/stock", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          productId: values.productId,
          quantity: values.quantity,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to update stock");
      }

      const selectedProduct = products.find((p) => p.id === values.productId);
      messageApi.success(
        `Đã nhập thêm ${values.quantity} ${selectedProduct?.name || "sản phẩm"} vào kho!`,
      );

      // Reset form
      form.resetFields();

      // Refresh data
      onStockUpdated();
    } catch (error) {
      console.error("Error updating stock:", error);
      messageApi.error("Có lỗi xảy ra khi cập nhật kho");
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
        <Form
          form={form}
          layout="vertical"
          onFinish={handleSubmit}
          autoComplete="off"
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

          <Form.Item
            name="quantity"
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

          <Form.Item>
            <Button
              type="primary"
              htmlType="submit"
              icon={<InboxOutlined />}
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
