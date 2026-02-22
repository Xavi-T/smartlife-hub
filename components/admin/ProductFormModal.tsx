"use client";

import { useState, useEffect } from "react";
import {
  Modal,
  Form,
  Input,
  InputNumber,
  Select,
  Switch,
  message,
  Card,
  Typography,
} from "antd";
import type { Product } from "@/types/database";

const { TextArea } = Input;

interface ProductFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  product?: Product | null;
  onSuccess?: () => void;
}

interface ProductFormValues {
  name: string;
  description?: string;
  price: number;
  discount_percent?: number;
  cost_price: number;
  categories: string[];
  is_active?: boolean;
}

interface CategoryOption {
  label: string;
  value: string;
}

export function ProductFormModal({
  isOpen,
  onClose,
  product,
  onSuccess,
}: ProductFormModalProps) {
  const [form] = Form.useForm();
  const descriptionValue = Form.useWatch("description", form) as
    | string
    | undefined;
  const [messageApi, contextHolder] = message.useMessage();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [categoryOptions, setCategoryOptions] = useState<CategoryOption[]>([]);

  const isEditMode = !!product;

  useEffect(() => {
    if (isOpen && product) {
      form.setFieldsValue({
        name: product.name,
        description: product.description,
        price: product.price,
        discount_percent: product.discount_percent || 0,
        cost_price: product.cost_price,
        categories:
          product.categories && product.categories.length > 0
            ? product.categories.map((item) => item.name)
            : [product.category],
        is_active: product.is_active,
      });
    } else if (isOpen && !product) {
      form.resetFields();
      form.setFieldsValue({
        is_active: true,
        discount_percent: 0,
        categories: [],
      });
    }
  }, [isOpen, product, form]);

  useEffect(() => {
    if (!isOpen) return;

    const fetchCategoryOptions = async () => {
      try {
        const response = await fetch("/api/admin/categories");
        const result = await response.json();
        if (!response.ok) return;

        setCategoryOptions(
          (result.categories || []).map((item: { name: string }) => ({
            label: item.name,
            value: item.name,
          })),
        );
      } catch {
        // Ignore and keep manual tag mode
      }
    };

    fetchCategoryOptions();
  }, [isOpen]);

  const handleSubmit = async (values: ProductFormValues) => {
    setIsSubmitting(true);

    try {
      const url = "/api/products";
      const method = isEditMode ? "PATCH" : "POST";
      const normalizedCategories = Array.from(
        new Set(
          (values.categories || []).map((item) => item.trim()).filter(Boolean),
        ),
      );

      const payload = {
        ...values,
        discount_percent:
          values.discount_percent === undefined ||
          values.discount_percent === null
            ? 0
            : Number(values.discount_percent),
        categories: normalizedCategories,
        category: normalizedCategories[0] || null,
      };

      const body = isEditMode ? { ...payload, id: product.id } : payload;

      const response = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Không thể lưu sản phẩm");
      }

      messageApi.success(
        isEditMode
          ? "Cập nhật sản phẩm thành công"
          : "Tạo sản phẩm mới thành công",
      );

      form.resetFields();
      if (onSuccess) onSuccess();
      onClose();
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : "Đã xảy ra lỗi";
      messageApi.error(errorMessage);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    if (!isSubmitting) {
      form.resetFields();
      onClose();
    }
  };

  return (
    <>
      {contextHolder}
      <Modal
        title={isEditMode ? "Chỉnh sửa sản phẩm" : "Thêm sản phẩm mới"}
        open={isOpen}
        onCancel={handleClose}
        onOk={() => form.submit()}
        confirmLoading={isSubmitting}
        okText={isEditMode ? "Cập nhật" : "Tạo mới"}
        cancelText="Hủy"
        width={700}
        destroyOnHidden
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={handleSubmit}
          disabled={isSubmitting}
        >
          <Form.Item
            label="Tên sản phẩm"
            name="name"
            rules={[
              { required: true, message: "Vui lòng nhập tên sản phẩm" },
              { min: 3, message: "Tên sản phẩm phải có ít nhất 3 ký tự" },
              { max: 255, message: "Tên sản phẩm không được quá 255 ký tự" },
            ]}
          >
            <Input placeholder="Ví dụ: Máy lọc không khí Xiaomi 4 Pro" />
          </Form.Item>

          <Form.Item
            label="Nội dung chi tiết sản phẩm"
            name="description"
            tooltip="Dùng như editor để viết thông tin nổi bật, thông số, hướng dẫn sử dụng..."
          >
            <TextArea
              rows={8}
              placeholder="Ví dụ:\n- Công suất: 2000W\n- Chất liệu: Inox 304\n- Bảo hành: 12 tháng\n\nHướng dẫn sử dụng:\n..."
              maxLength={3000}
              showCount
            />
          </Form.Item>

          <Card
            size="small"
            title="Xem trước nội dung"
            style={{ marginBottom: 16 }}
          >
            {descriptionValue && descriptionValue.trim() ? (
              <Typography.Paragraph
                style={{ whiteSpace: "pre-wrap", marginBottom: 0 }}
              >
                {descriptionValue}
              </Typography.Paragraph>
            ) : (
              <Typography.Text type="secondary">
                Chưa có nội dung chi tiết.
              </Typography.Text>
            )}
          </Card>

          <div
            style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}
          >
            <Form.Item
              label="Giá vốn (VNĐ)"
              name="cost_price"
              rules={[
                { required: true, message: "Vui lòng nhập giá vốn" },
                {
                  type: "number",
                  min: 0,
                  message: "Giá vốn phải lớn hơn hoặc bằng 0",
                },
              ]}
            >
              <InputNumber
                style={{ width: "100%" }}
                placeholder="0"
                formatter={(value) =>
                  `${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ",")
                }
                parser={(value) => value!.replace(/\$\s?|(,*)/g, "")}
              />
            </Form.Item>

            <Form.Item
              label="Giá bán (VNĐ)"
              name="price"
              rules={[
                { required: true, message: "Vui lòng nhập giá bán" },
                {
                  type: "number",
                  min: 0,
                  message: "Giá bán phải lớn hơn hoặc bằng 0",
                },
                ({ getFieldValue }) => ({
                  validator(_, value) {
                    const costPrice = getFieldValue("cost_price");
                    if (!value || !costPrice || value >= costPrice) {
                      return Promise.resolve();
                    }
                    return Promise.reject(
                      new Error("Giá bán phải lớn hơn hoặc bằng giá vốn"),
                    );
                  },
                }),
              ]}
            >
              <InputNumber
                style={{ width: "100%" }}
                placeholder="0"
                formatter={(value) =>
                  `${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ",")
                }
                parser={(value) => value!.replace(/\$\s?|(,*)/g, "")}
              />
            </Form.Item>

            <Form.Item
              label="Giảm giá (%)"
              name="discount_percent"
              tooltip="Nhập từ 0 đến 100. Giá hiển thị cho khách sẽ tự tính sau giảm giá."
              rules={[
                {
                  transform: (value) =>
                    value === "" || value === null || value === undefined
                      ? 0
                      : Number(value),
                  type: "number",
                  message: "Giảm giá phải là số",
                },
                {
                  type: "number",
                  min: 0,
                  max: 100,
                  message: "Giảm giá phải trong khoảng 0-100%",
                },
              ]}
            >
              <InputNumber<number>
                style={{ width: "100%" }}
                placeholder="0"
                min={0}
                max={100}
                precision={0}
                step={1}
              />
            </Form.Item>
          </div>

          <Form.Item
            label="Danh mục"
            name="categories"
            rules={[
              { required: true, message: "Vui lòng chọn ít nhất 1 danh mục" },
            ]}
            tooltip="Có thể chọn nhiều danh mục hoặc gõ để tạo mới"
          >
            <Select
              placeholder="Chọn hoặc nhập danh mục"
              showSearch
              mode="tags"
              options={categoryOptions}
            />
          </Form.Item>

          <Typography.Text
            type="secondary"
            style={{ display: "block", marginBottom: 16 }}
          >
            Tồn kho ban đầu mặc định bằng 0. Sau khi tạo sản phẩm, dùng chức
            năng Nhập kho để thêm hàng vào kho.
          </Typography.Text>

          <Typography.Text
            type="secondary"
            style={{ display: "block", marginBottom: 16 }}
          >
            Sản phẩm mới mặc định chưa có ảnh đại diện. Sau khi tạo, vào phần
            media của sản phẩm để upload và đặt ảnh cover.
          </Typography.Text>

          <Form.Item
            label="Trạng thái"
            name="is_active"
            valuePropName="checked"
          >
            <Switch checkedChildren="Hiển thị" unCheckedChildren="Ẩn" />
          </Form.Item>
        </Form>
      </Modal>
    </>
  );
}
