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
  Button,
  Image,
  Card,
  Space,
} from "antd";
import { PictureOutlined, CopyOutlined } from "@ant-design/icons";
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
  cost_price: number;
  stock_quantity?: number;
  categories: string[];
  image_url?: string;
  is_active?: boolean;
}

interface MediaFile {
  name: string;
  path: string;
  url: string;
  size: number;
  mimeType: string | null;
  createdAt: string | null;
  updatedAt: string | null;
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
  const [messageApi, contextHolder] = message.useMessage();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isMediaModalOpen, setIsMediaModalOpen] = useState(false);
  const [mediaFiles, setMediaFiles] = useState<MediaFile[]>([]);
  const [isLoadingMedia, setIsLoadingMedia] = useState(false);
  const [categoryOptions, setCategoryOptions] = useState<CategoryOption[]>([]);

  const isEditMode = !!product;

  useEffect(() => {
    if (isOpen && product) {
      form.setFieldsValue({
        name: product.name,
        description: product.description,
        price: product.price,
        cost_price: product.cost_price,
        stock_quantity: product.stock_quantity,
        categories:
          product.categories && product.categories.length > 0
            ? product.categories.map((item) => item.name)
            : [product.category],
        image_url: product.image_url,
        is_active: product.is_active,
      });
    } else if (isOpen && !product) {
      form.resetFields();
      form.setFieldsValue({
        is_active: true,
        stock_quantity: 0,
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

  const fetchMediaFiles = async () => {
    setIsLoadingMedia(true);
    try {
      const response = await fetch("/api/admin/media");
      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.error || "Không thể tải thư viện media");
      }
      setMediaFiles(result.files || []);
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : "Không thể tải thư viện media";
      messageApi.error(errorMessage);
    } finally {
      setIsLoadingMedia(false);
    }
  };

  const openMediaPicker = async () => {
    setIsMediaModalOpen(true);
    await fetchMediaFiles();
  };

  const handlePickMedia = (url: string) => {
    form.setFieldValue("image_url", url);
    messageApi.success("Đã chọn ảnh từ thư viện media");
    setIsMediaModalOpen(false);
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

          <Form.Item label="Mô tả" name="description">
            <TextArea
              rows={3}
              placeholder="Mô tả chi tiết về sản phẩm..."
              maxLength={1000}
              showCount
            />
          </Form.Item>

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
          </div>

          <div
            style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}
          >
            <Form.Item
              label="Tồn kho ban đầu"
              name="stock_quantity"
              rules={[
                {
                  type: "number",
                  min: 0,
                  message: "Tồn kho phải lớn hơn hoặc bằng 0",
                },
              ]}
              tooltip="Để cập nhật tồn kho sau này, dùng chức năng Nhập hàng"
            >
              <InputNumber
                style={{ width: "100%" }}
                placeholder="0"
                disabled={isEditMode}
              />
            </Form.Item>

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
          </div>

          <Form.Item
            label="URL ảnh đại diện"
            name="image_url"
            tooltip="Để quản lý nhiều ảnh, vào trang chi tiết sản phẩm sau khi tạo"
          >
            <Input placeholder="https://..." />
          </Form.Item>

          <div style={{ marginTop: -8, marginBottom: 16 }}>
            <Space>
              <Button icon={<PictureOutlined />} onClick={openMediaPicker}>
                Chọn từ thư viện media
              </Button>
              <Button
                icon={<CopyOutlined />}
                onClick={async () => {
                  const currentUrl = form.getFieldValue("image_url");
                  if (!currentUrl) {
                    messageApi.error("Chưa có URL ảnh để copy");
                    return;
                  }
                  await navigator.clipboard.writeText(currentUrl);
                  messageApi.success("Đã copy URL ảnh");
                }}
              >
                Copy URL
              </Button>
            </Space>
          </div>

          <Form.Item
            label="Trạng thái"
            name="is_active"
            valuePropName="checked"
          >
            <Switch checkedChildren="Hiển thị" unCheckedChildren="Ẩn" />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title="Chọn ảnh từ thư viện media"
        open={isMediaModalOpen}
        onCancel={() => setIsMediaModalOpen(false)}
        footer={null}
        width={900}
      >
        {isLoadingMedia ? (
          <div style={{ textAlign: "center", padding: 32 }}>Đang tải...</div>
        ) : mediaFiles.length === 0 ? (
          <div style={{ textAlign: "center", padding: 32, color: "#8c8c8c" }}>
            Chưa có ảnh trong thư viện. Vào mục Thư viện media để upload ảnh
            trước.
          </div>
        ) : (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))",
              gap: 12,
              maxHeight: 500,
              overflowY: "auto",
            }}
          >
            {mediaFiles.map((file) => (
              <Card
                key={file.path}
                hoverable
                onClick={() => handlePickMedia(file.url)}
                bodyStyle={{ padding: 8 }}
              >
                <Image
                  src={file.url}
                  alt={file.name}
                  width="100%"
                  height={120}
                  style={{ objectFit: "cover", borderRadius: 6 }}
                  preview={false}
                />
                <div
                  style={{
                    marginTop: 8,
                    fontSize: 12,
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                  }}
                >
                  {file.name}
                </div>
              </Card>
            ))}
          </div>
        )}
      </Modal>
    </>
  );
}
