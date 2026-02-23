"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Alert,
  Button,
  Card,
  DatePicker,
  Form,
  Input,
  InputNumber,
  Select,
  Space,
  Spin,
  Switch,
  Typography,
  message,
} from "antd";
import { ArrowLeftOutlined, SaveOutlined } from "@ant-design/icons";
import dayjs, { type Dayjs } from "dayjs";
import type { Product } from "@/types/database";
import { RichTextEditor } from "@/components/admin/RichTextEditor";

const { RangePicker } = DatePicker;

interface ProductFormValues {
  name: string;
  description?: string;
  price: number;
  discount_percent?: number;
  discount_period?: [Dayjs, Dayjs];
  cost_price: number;
  categories: string[];
  is_active?: boolean;
}

interface CategoryOption {
  label: string;
  value: string;
}

interface ProductMediaItem {
  id: string;
  image_url: string;
  is_cover: boolean;
  media_type: "image" | "video";
}

interface EditorMediaImage {
  id: string;
  url: string;
  isCover?: boolean;
}

interface ProductFormPageProps {
  mode: "create" | "edit";
  productId?: string;
}

export function ProductFormPage({ mode, productId }: ProductFormPageProps) {
  const router = useRouter();
  const [form] = Form.useForm<ProductFormValues>();
  const [messageApi, contextHolder] = message.useMessage();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoadingProduct, setIsLoadingProduct] = useState(mode === "edit");
  const [categoryOptions, setCategoryOptions] = useState<CategoryOption[]>([]);
  const [editorMediaImages, setEditorMediaImages] = useState<
    EditorMediaImage[]
  >([]);
  const discountPercent = Number(Form.useWatch("discount_percent", form) || 0);
  const hasDiscount = discountPercent > 0;

  const isEditMode = mode === "edit";

  const pageTitle = useMemo(
    () => (isEditMode ? "Chỉnh sửa sản phẩm" : "Thêm sản phẩm mới"),
    [isEditMode],
  );

  useEffect(() => {
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
  }, []);

  useEffect(() => {
    if (!isEditMode || !productId) {
      form.resetFields();
      setEditorMediaImages([]);
      form.setFieldsValue({
        is_active: true,
        discount_percent: 0,
        discount_period: undefined,
        categories: [],
      });
      setIsLoadingProduct(false);
      return;
    }

    const fetchProduct = async () => {
      setIsLoadingProduct(true);
      try {
        const res = await fetch("/api/products");
        if (!res.ok) throw new Error("Không thể tải dữ liệu sản phẩm");

        const products = (await res.json()) as Product[];
        const product = products.find((item) => item.id === productId);

        if (!product) {
          messageApi.error("Không tìm thấy sản phẩm");
          router.push("/admin/products");
          return;
        }

        form.setFieldsValue({
          name: product.name,
          description: product.description || undefined,
          price: product.price,
          discount_percent: product.discount_percent || 0,
          discount_period:
            product.discount_start_at && product.discount_end_at
              ? [
                  dayjs(product.discount_start_at),
                  dayjs(product.discount_end_at),
                ]
              : undefined,
          cost_price: product.cost_price,
          categories:
            product.categories && product.categories.length > 0
              ? product.categories.map((item) => item.name)
              : [product.category],
          is_active: product.is_active,
        });

        const mediaRes = await fetch(`/api/products/${productId}/media`);
        if (mediaRes.ok) {
          const mediaList = (await mediaRes.json()) as ProductMediaItem[];
          setEditorMediaImages(
            mediaList
              .filter((item) => item.media_type === "image" && item.image_url)
              .map((item) => ({
                id: item.id,
                url: item.image_url,
                isCover: item.is_cover,
              })),
          );
        } else {
          setEditorMediaImages([]);
        }
      } catch (error) {
        console.error("Error fetching product:", error);
        messageApi.error("Không thể tải thông tin sản phẩm");
        router.push("/admin/products");
      } finally {
        setIsLoadingProduct(false);
      }
    };

    fetchProduct();
  }, [form, isEditMode, messageApi, productId, router]);

  useEffect(() => {
    if (!hasDiscount) {
      form.setFieldValue("discount_period", undefined);
    }
  }, [form, hasDiscount]);

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
        discount_start_at:
          Number(values.discount_percent || 0) > 0 &&
          values.discount_period?.[0]
            ? values.discount_period[0].toISOString()
            : null,
        discount_end_at:
          Number(values.discount_percent || 0) > 0 &&
          values.discount_period?.[1]
            ? values.discount_period[1].toISOString()
            : null,
        categories: normalizedCategories,
        category: normalizedCategories[0] || null,
      };

      const body = isEditMode ? { ...payload, id: productId } : payload;

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

      router.push("/admin/products");
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : "Đã xảy ra lỗi";
      messageApi.error(errorMessage);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div style={{ background: "#f5f5f5", minHeight: "100vh", padding: 24 }}>
      {contextHolder}

      <div style={{ maxWidth: 960, margin: "0 auto" }}>
        <Space direction="orientation" size={16} style={{ width: "100%" }}>
          <Space style={{ justifyContent: "space-between", width: "100%" }}>
            <Space direction="orientation" size={0}>
              <Typography.Title level={2} style={{ margin: 0 }}>
                {pageTitle}
              </Typography.Title>
              <Typography.Text type="secondary">
                {isEditMode
                  ? "Cập nhật thông tin sản phẩm và trạng thái hiển thị"
                  : "Tạo sản phẩm mới trước khi nhập kho"}
              </Typography.Text>
            </Space>

            <Space>
              <Button
                icon={<ArrowLeftOutlined />}
                onClick={() => router.push("/admin/products")}
              >
                Quay lại
              </Button>
              <Button
                type="primary"
                icon={<SaveOutlined />}
                onClick={() => form.submit()}
                loading={isSubmitting}
              >
                {isEditMode ? "Lưu thay đổi" : "Tạo sản phẩm"}
              </Button>
            </Space>
          </Space>

          {isLoadingProduct ? (
            <Card>
              <div style={{ textAlign: "center", padding: 40 }}>
                <Spin />
              </div>
            </Card>
          ) : (
            <Card>
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
                    {
                      max: 255,
                      message: "Tên sản phẩm không được quá 255 ký tự",
                    },
                  ]}
                >
                  <Input placeholder="Ví dụ: Máy lọc không khí Xiaomi 4 Pro" />
                </Form.Item>

                <Form.Item
                  label="Nội dung chi tiết sản phẩm"
                  name="description"
                  tooltip="Dùng như editor để viết thông tin nổi bật, thông số, hướng dẫn sử dụng..."
                >
                  <RichTextEditor
                    placeholder="Ví dụ: tiêu đề, thông số, hướng dẫn sử dụng, hình ảnh minh họa..."
                    productMediaImages={editorMediaImages}
                  />
                </Form.Item>

                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1fr 1fr",
                    gap: 16,
                  }}
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

                  <Form.Item
                    label="Thời gian hiệu lực giảm giá"
                    name="discount_period"
                    dependencies={["discount_percent"]}
                    tooltip="Áp dụng khi giảm giá > 0%. Hệ thống sẽ tự tắt giảm giá khi hết thời gian."
                    rules={[
                      ({ getFieldValue }) => ({
                        validator(_, value) {
                          const discount = Number(
                            getFieldValue("discount_percent") || 0,
                          );
                          if (discount <= 0) return Promise.resolve();

                          if (!value || !value[0] || !value[1]) {
                            return Promise.reject(
                              new Error(
                                "Vui lòng chọn thời gian bắt đầu và kết thúc",
                              ),
                            );
                          }

                          if (
                            value[1].isSame(value[0]) ||
                            value[1].isBefore(value[0])
                          ) {
                            return Promise.reject(
                              new Error(
                                "Thời gian kết thúc phải sau thời gian bắt đầu",
                              ),
                            );
                          }

                          return Promise.resolve();
                        },
                      }),
                    ]}
                  >
                    <RangePicker
                      style={{ width: "100%" }}
                      showTime
                      format="DD/MM/YYYY HH:mm"
                      disabled={!hasDiscount}
                      placeholder={["Bắt đầu", "Kết thúc"]}
                    />
                  </Form.Item>
                </div>

                <Form.Item
                  label="Danh mục"
                  name="categories"
                  rules={[
                    {
                      required: true,
                      message: "Vui lòng chọn ít nhất 1 danh mục",
                    },
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

                {!isEditMode && (
                  <Alert
                    type="info"
                    showIcon
                    style={{ marginBottom: 16 }}
                    message="Tồn kho ban đầu"
                    description="Tồn kho ban đầu mặc định bằng 0. Sau khi tạo sản phẩm, dùng chức năng Nhập kho để thêm hàng vào kho."
                  />
                )}

                <Alert
                  type="info"
                  showIcon
                  style={{ marginBottom: 16 }}
                  message="Ảnh sản phẩm"
                  description="Sản phẩm mới mặc định chưa có ảnh đại diện. Sau khi tạo, vào phần media của sản phẩm để upload và đặt ảnh cover."
                />

                <Form.Item
                  label="Trạng thái"
                  name="is_active"
                  valuePropName="checked"
                >
                  <Switch checkedChildren="Hiển thị" unCheckedChildren="Ẩn" />
                </Form.Item>
              </Form>
            </Card>
          )}
        </Space>
      </div>
    </div>
  );
}
