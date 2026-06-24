"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Alert,
  Button,
  Card,
  DatePicker,
  Divider,
  Form,
  Image,
  Input,
  InputNumber,
  Modal,
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
import { ImageUpload } from "@/components/admin/ImageUpload";
import { ImageGallery } from "@/components/admin/ImageGallery";
import {
  compressImage,
  formatFileSize,
  getImageDimensions,
  validateImageFile,
} from "@/lib/imageUtils";
import { normalizeHtmlContent } from "@/lib/htmlContent";

const { RangePicker } = DatePicker;

interface ProductFormValues {
  name: string;
  description?: string;
  price?: number;
  discount_percent?: number;
  discount_period?: [Dayjs, Dayjs];
  cost_price?: number;
  stock_quantity?: number;
  price_on_request?: boolean;
  categories: string[];
  has_variants?: boolean;
  variants?: Array<{
    variant_name: string;
    cost_price: number;
    price: number;
    image_url?: string;
    sort_order?: number;
    is_active?: boolean;
  }>;
  is_active?: boolean;
}

interface CategoryOption {
  label: string;
  value: string;
}

interface ProductGalleryItem {
  id: string;
  image_url: string;
  display_order: number;
  is_cover: boolean;
  file_size: number | null;
  width: number | null;
  height: number | null;
  media_type?: "image" | "video";
}

interface EditorMediaImage {
  id: string;
  url: string;
  isCover?: boolean;
}

interface PendingMediaFile {
  id: string;
  file: File;
  preview: string;
  mediaType: "image" | "video";
  status: "ready" | "uploading" | "done" | "error";
  error?: string;
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
  const [productMediaItems, setProductMediaItems] = useState<
    ProductGalleryItem[]
  >([]);
  const [pendingMediaFiles, setPendingMediaFiles] = useState<
    PendingMediaFile[]
  >([]);
  const [hasUnsavedCreateDraft, setHasUnsavedCreateDraft] = useState(false);
  const [coverPendingMediaId, setCoverPendingMediaId] = useState<string | null>(
    null,
  );
  const [isLoadingMedia, setIsLoadingMedia] = useState(false);
  const [variantImagePickerIndex, setVariantImagePickerIndex] = useState<
    number | null
  >(null);
  const createSaveTargetRef = useRef<"edit" | "list">("edit");

  const variantsValue = Form.useWatch("variants", form) || [];
  const hasVariants = Boolean(Form.useWatch("has_variants", form));
  const discountPercent = Number(Form.useWatch("discount_percent", form) || 0);
  const hasDiscount = discountPercent > 0;
  const isEditMode = mode === "edit";

  const pageTitle = useMemo(
    () => (isEditMode ? "Chỉnh sửa sản phẩm" : "Thêm sản phẩm mới"),
    [isEditMode],
  );

  const mediaImageOptions = useMemo(
    () =>
      editorMediaImages.map((item, index) => ({
        label: item.isCover
          ? `Ảnh cover #${index + 1}`
          : `Ảnh media #${index + 1}`,
        value: item.url,
      })),
    [editorMediaImages],
  );

  const detectPendingMediaType = (file: File): "image" | "video" | null => {
    if (file.type.startsWith("image/")) return "image";
    if (file.type.startsWith("video/")) return "video";
    return null;
  };

  const validatePendingMediaFile = (file: File) => {
    const mediaType = detectPendingMediaType(file);
    if (!mediaType) {
      return {
        valid: false,
        error: "Chỉ hỗ trợ ảnh hoặc video (JPG, PNG, WEBP, MP4, MOV, WEBM)",
      };
    }

    if (mediaType === "image") return validateImageFile(file);

    if (file.size > 100 * 1024 * 1024) {
      return { valid: false, error: "Video không được vượt quá 100MB" };
    }

    return { valid: true };
  };

  const handlePendingMediaSelect = (files: FileList | null) => {
    if (!files) return;

    const remainingSlots = Math.max(0, 10 - pendingMediaFiles.length);
    const selectedFiles = Array.from(files).slice(0, remainingSlots);
    if (selectedFiles.length === 0) {
      messageApi.warning("Tối đa 10 file media cho mỗi sản phẩm");
      return;
    }

    const nextItems: PendingMediaFile[] = [];
    const errors: string[] = [];

    selectedFiles.forEach((file) => {
      const validation = validatePendingMediaFile(file);
      const mediaType = detectPendingMediaType(file);

      if (!validation.valid || !mediaType) {
        errors.push(`${file.name}: ${validation.error || "File không hợp lệ"}`);
        return;
      }

      nextItems.push({
        id: `pending-media-${Date.now()}-${Math.random()
          .toString(36)
          .slice(2, 8)}`,
        file,
        preview: URL.createObjectURL(file),
        mediaType,
        status: "ready",
      });
    });

    if (errors.length > 0) {
      messageApi.error(errors.join("\n"));
    }

    if (nextItems.length > 0) {
      setPendingMediaFiles((current) => [...current, ...nextItems]);
      if (!coverPendingMediaId) {
        const firstImage = nextItems.find((item) => item.mediaType === "image");
        if (firstImage) setCoverPendingMediaId(firstImage.id);
      }
    }
  };

  const removePendingMediaFile = (fileId: string) => {
    setPendingMediaFiles((current) => {
      const target = current.find((item) => item.id === fileId);
      if (target) URL.revokeObjectURL(target.preview);
      const nextItems = current.filter((item) => item.id !== fileId);
      if (coverPendingMediaId === fileId) {
        setCoverPendingMediaId(
          nextItems.find((item) => item.mediaType === "image")?.id || null,
        );
      }
      return nextItems;
    });
  };

  const movePendingMediaFile = (fileId: string, direction: -1 | 1) => {
    setPendingMediaFiles((current) => {
      const currentIndex = current.findIndex((item) => item.id === fileId);
      const nextIndex = currentIndex + direction;
      if (
        currentIndex < 0 ||
        nextIndex < 0 ||
        nextIndex >= current.length
      ) {
        return current;
      }

      const nextItems = [...current];
      const [movedItem] = nextItems.splice(currentIndex, 1);
      nextItems.splice(nextIndex, 0, movedItem);
      return nextItems;
    });
  };

  const navigateBackToProducts = () => {
    if (
      !isEditMode &&
      (pendingMediaFiles.length > 0 || hasUnsavedCreateDraft) &&
      !window.confirm("Bạn đang tạo sản phẩm nhưng chưa lưu. Rời trang?")
    ) {
      return;
    }

    router.push("/admin/products");
  };

  const uploadPendingMediaFiles = async (createdProductId: string) => {
    let successCount = 0;
    let failedCount = 0;

    for (const item of pendingMediaFiles) {
      setPendingMediaFiles((current) =>
        current.map((media) =>
          media.id === item.id
            ? { ...media, status: "uploading", error: undefined }
            : media,
        ),
      );

      try {
        let uploadFile = item.file;
        let dimensions: { width: number; height: number } | null = null;

        if (item.mediaType === "image") {
          uploadFile = await compressImage(item.file, 1200, 1200, 0.85);
          dimensions = await getImageDimensions(uploadFile);
        }

        const formData = new FormData();
        formData.append("file", uploadFile);
        formData.append("productId", createdProductId);
        formData.append(
          "isCover",
          item.id === coverPendingMediaId ? "true" : "false",
        );
        if (dimensions) {
          formData.append("width", dimensions.width.toString());
          formData.append("height", dimensions.height.toString());
        }

        const response = await fetch("/api/admin/product-images", {
          method: "POST",
          body: formData,
        });
        const result = await response.json();
        if (!response.ok) {
          throw new Error(result.error || "Upload media thất bại");
        }

        successCount += 1;
        setPendingMediaFiles((current) =>
          current.map((media) =>
            media.id === item.id ? { ...media, status: "done" } : media,
          ),
        );
      } catch (error: unknown) {
        failedCount += 1;
        setPendingMediaFiles((current) =>
          current.map((media) =>
            media.id === item.id
              ? {
                  ...media,
                  status: "error",
                  error:
                    error instanceof Error
                      ? error.message
                      : "Upload media thất bại",
                }
              : media,
          ),
        );
      }
    }

    return { successCount, failedCount };
  };

  useEffect(() => {
    if (
      isEditMode ||
      (pendingMediaFiles.length === 0 && !hasUnsavedCreateDraft)
    ) {
      return;
    }

    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [hasUnsavedCreateDraft, isEditMode, pendingMediaFiles.length]);

  const fetchProductMedia = useCallback(async () => {
    if (!isEditMode || !productId) {
      setProductMediaItems([]);
      setEditorMediaImages([]);
      return;
    }

    setIsLoadingMedia(true);
    try {
      const mediaRes = await fetch(
        `/api/admin/product-images?productId=${productId}&t=${Date.now()}`,
        { cache: "no-store" },
      );

      if (!mediaRes.ok) {
        setProductMediaItems([]);
        setEditorMediaImages([]);
        return;
      }

      const mediaList = (await mediaRes.json()) as ProductGalleryItem[];
      const sorted = [...mediaList].sort(
        (a, b) => Number(a.display_order || 0) - Number(b.display_order || 0),
      );
      setProductMediaItems(sorted);
      setEditorMediaImages(
        sorted
          .filter(
            (item) => !/\.(mp4|webm|mov|m4v)(\?|#|$)/i.test(item.image_url),
          )
          .map((item) => ({
            id: item.id,
            url: item.image_url,
            isCover: item.is_cover,
          })),
      );
    } catch {
      setProductMediaItems([]);
      setEditorMediaImages([]);
    } finally {
      setIsLoadingMedia(false);
    }
  }, [isEditMode, productId]);

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
        // keep manual tags
      }
    };

    fetchCategoryOptions();
  }, []);

  useEffect(() => {
    if (!isEditMode || !productId) {
      form.resetFields();
      setEditorMediaImages([]);
      setProductMediaItems([]);
      form.setFieldsValue({
        is_active: true,
        has_variants: false,
        discount_percent: 0,
        discount_period: undefined,
        price: 0,
        cost_price: 0,
        stock_quantity: 0,
        price_on_request: false,
        categories: [],
        variants: [],
      });
      setIsLoadingProduct(false);
      return;
    }

    const fetchProduct = async () => {
      setIsLoadingProduct(true);
      try {
        const res = await fetch(`/api/products?noCache=1&t=${Date.now()}`, {
          cache: "no-store",
        });
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
          description: normalizeHtmlContent(product.description) || undefined,
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
          price_on_request: product.price_on_request === true,
          categories: Array.from(
            new Set(
              (product.categories && product.categories.length > 0
                ? product.categories.map((item) => item.name)
                : [product.category]
              )
                .map((item) => String(item || "").trim())
                .filter(Boolean),
            ),
          ),
          has_variants: (product.variants || []).length > 0,
          variants: (product.variants || []).map((variant, index) => ({
            variant_name: variant.variant_name,
            cost_price: Number(variant.cost_price || 0),
            price: Number(variant.price || 0),
            image_url: variant.image_url || undefined,
            sort_order: variant.sort_order || index + 1,
            is_active: variant.is_active !== false,
          })),
          is_active: product.is_active,
        });

        await fetchProductMedia();
      } catch (error) {
        console.error("Error fetching product:", error);
        messageApi.error("Không thể tải thông tin sản phẩm");
        router.push("/admin/products");
      } finally {
        setIsLoadingProduct(false);
      }
    };

    fetchProduct();
  }, [fetchProductMedia, form, isEditMode, messageApi, productId, router]);

  useEffect(() => {
    if (!hasDiscount) {
      form.setFieldValue("discount_period", undefined);
    }
  }, [form, hasDiscount]);

  const handleSubmit = async (values: ProductFormValues) => {
    setIsSubmitting(true);

    try {
      const normalizedCategories = Array.from(
        new Set(
          (values.categories || []).map((item) => item.trim()).filter(Boolean),
        ),
      );

      const normalizedVariants = (values.variants || [])
        .map((item, index) => ({
          variant_name: String(item.variant_name || "").trim(),
          cost_price: Number(item.cost_price || 0),
          price: Number(item.price || 0),
          image_url: String(item.image_url || "").trim() || null,
          sort_order: Number(item.sort_order || index + 1),
          is_active: item.is_active !== false,
        }))
        .filter(
          (item) =>
            item.variant_name &&
            Number.isFinite(item.cost_price) &&
            Number.isFinite(item.price) &&
            item.cost_price >= 0 &&
            item.price >= item.cost_price,
        );

      const useVariants = values.has_variants === true;
      if (useVariants && normalizedVariants.length === 0) {
        throw new Error("Vui lòng thêm ít nhất 1 phân loại sản phẩm");
      }

      const initialStockQuantity = Math.trunc(Number(values.stock_quantity || 0));
      if (!isEditMode && initialStockQuantity < 0) {
        throw new Error("Tồn kho ban đầu không được âm");
      }

      const baseCost = useVariants
        ? normalizedVariants[0].cost_price
        : Number(values.cost_price || 0);
      const basePrice = useVariants
        ? normalizedVariants[0].price
        : Number(values.price || 0);

      if (baseCost < 0 || basePrice < 0 || basePrice < baseCost) {
        throw new Error("Giá bán phải lớn hơn hoặc bằng giá vốn");
      }

      const payload = {
        ...values,
        cost_price: baseCost,
        price: basePrice,
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
        stock_quantity: isEditMode ? undefined : initialStockQuantity,
        categories: normalizedCategories,
        category: normalizedCategories[0] || null,
        variants: useVariants ? normalizedVariants : [],
        price_on_request: values.price_on_request === true,
      };

      const response = await fetch("/api/products", {
        method: isEditMode ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          isEditMode ? { ...payload, id: productId } : payload,
        ),
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

      if (!isEditMode) {
        const createdProductId =
          typeof result?.product?.id === "string" ? result.product.id : null;
        if (createdProductId) {
          let shouldOpenCreatedProduct = createSaveTargetRef.current === "edit";

          if (pendingMediaFiles.length > 0) {
            messageApi.loading({
              content: "Đang upload media sản phẩm...",
              key: "product-media-upload",
              duration: 0,
            });
            const uploadSummary = await uploadPendingMediaFiles(createdProductId);
            messageApi.destroy("product-media-upload");

            if (uploadSummary.failedCount > 0) {
              shouldOpenCreatedProduct = true;
              messageApi.warning(
                `Đã tạo sản phẩm. Upload thành công ${uploadSummary.successCount}/${pendingMediaFiles.length} media, ${uploadSummary.failedCount} file lỗi.`,
              );
            } else {
              messageApi.success(
                `Đã tạo sản phẩm và upload ${uploadSummary.successCount} media`,
              );
            }

            pendingMediaFiles.forEach((item) =>
              URL.revokeObjectURL(item.preview),
            );
            setPendingMediaFiles([]);
            setCoverPendingMediaId(null);
          }
          setHasUnsavedCreateDraft(false);
          if (shouldOpenCreatedProduct) {
            router.push(`/admin/products/${createdProductId}/edit`);
          } else {
            router.push("/admin/products");
          }
        } else {
          router.push("/admin/products");
        }
      }
    } catch (error: unknown) {
      messageApi.error(
        error instanceof Error ? error.message : "Đã xảy ra lỗi",
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const renderSaveActions = (options?: {
    includeBack?: boolean;
    justify?: "start" | "end";
  }) => (
    <Space
      wrap
      style={{
        width: options?.justify === "end" ? "100%" : undefined,
        justifyContent:
          options?.justify === "end" ? "flex-end" : "flex-start",
      }}
    >
      {options?.includeBack ? (
        <Button icon={<ArrowLeftOutlined />} onClick={navigateBackToProducts}>
          Quay lại
        </Button>
      ) : null}
      {isEditMode ? (
        <Button
          type="primary"
          icon={<SaveOutlined />}
          onClick={() => form.submit()}
          loading={isSubmitting}
        >
          Lưu thay đổi
        </Button>
      ) : (
        <>
          <Button
            icon={<SaveOutlined />}
            onClick={() => {
              createSaveTargetRef.current = "list";
              form.submit();
            }}
            loading={isSubmitting}
          >
            Tạo và về danh sách
          </Button>
          <Button
            type="primary"
            icon={<SaveOutlined />}
            onClick={() => {
              createSaveTargetRef.current = "edit";
              form.submit();
            }}
            loading={isSubmitting}
          >
            Tạo và chỉnh tiếp
          </Button>
        </>
      )}
    </Space>
  );

  return (
    <div style={{ background: "#f5f5f5", minHeight: "100vh", padding: 24 }}>
      {contextHolder}

      <div style={{ maxWidth: 1080, margin: "0 auto" }}>
        <Space orientation="vertical" size={16} style={{ width: "100%" }}>
          <Card size="small">
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                gap: 12,
                flexWrap: "wrap",
              }}
            >
              <Space orientation="vertical" size={2}>
                <Typography.Title level={3} style={{ margin: 0 }}>
                  {pageTitle}
                </Typography.Title>
                <Typography.Text type="secondary">
                  {isEditMode
                    ? "Cập nhật thông tin sản phẩm và phân loại"
                    : "Tạo sản phẩm, tồn kho ban đầu và media trong một luồng"}
                </Typography.Text>
              </Space>

              {renderSaveActions({ includeBack: true })}
            </div>
          </Card>

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
                onValuesChange={() => {
                  if (!isEditMode) setHasUnsavedCreateDraft(true);
                }}
                disabled={isSubmitting}
              >
                <Typography.Title level={5}>Thông tin cơ bản</Typography.Title>

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
                  tooltip="Dùng editor để viết thông tin nổi bật, thông số, hướng dẫn sử dụng..."
                >
                  <RichTextEditor
                    placeholder="Ví dụ: tiêu đề, thông số, hướng dẫn sử dụng, hình ảnh minh họa..."
                    productMediaImages={editorMediaImages}
                  />
                </Form.Item>

                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
                    gap: 16,
                  }}
                >
                  {!hasVariants && (
                    <>
                      <Form.Item
                        label="Giá vốn (VNĐ)"
                        name="cost_price"
                        rules={[
                          { required: true, message: "Vui lòng nhập giá vốn" },
                          {
                            type: "number",
                            min: 0,
                            message: "Giá vốn phải >= 0",
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
                            message: "Giá bán phải >= 0",
                          },
                          ({ getFieldValue }) => ({
                            validator(_, value) {
                              const costPrice = getFieldValue("cost_price");
                              if (
                                value === undefined ||
                                value === null ||
                                costPrice === undefined ||
                                costPrice === null ||
                                value >= costPrice
                              ) {
                                return Promise.resolve();
                              }
                              return Promise.reject(
                                new Error(
                                  "Giá bán phải lớn hơn hoặc bằng giá vốn",
                                ),
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
                    </>
                  )}

                  <Form.Item
                    label="Giá bán công khai"
                    name="price_on_request"
                    valuePropName="checked"
                    tooltip="Bật khi sản phẩm chưa có giá bán. Website vẫn hiển thị sản phẩm nhưng đổi nút mua thành Liên hệ đặt mua."
                  >
                    <Switch
                      checkedChildren="Liên hệ"
                      unCheckedChildren="Hiện giá"
                    />
                  </Form.Item>

                  {!isEditMode && (
                    <Form.Item
                      label="Tồn kho ban đầu"
                      name="stock_quantity"
                      tooltip="Nếu đã có hàng sẵn, nhập số lượng tại đây. Hệ thống sẽ tự ghi lịch sử nhập kho khi tạo sản phẩm."
                      rules={[
                        {
                          type: "number",
                          min: 0,
                          message: "Tồn kho không được âm",
                        },
                      ]}
                    >
                      <InputNumber
                        style={{ width: "100%" }}
                        min={0}
                        precision={0}
                        placeholder="0"
                      />
                    </Form.Item>
                  )}

                  <Form.Item
                    label="Giảm giá (%)"
                    name="discount_percent"
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
                        message: "Trong khoảng 0-100%",
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
                      allowEmpty={[true, true]}
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

                <Card
                  size="small"
                  style={{ marginBottom: 16, background: "#fafafa" }}
                >
                  <Space
                    style={{
                      width: "100%",
                      justifyContent: "space-between",
                    }}
                    align="center"
                  >
                    <Space orientation="vertical" size={2}>
                      <Typography.Text strong>
                        Sản phẩm có nhiều phân loại
                      </Typography.Text>
                      <Typography.Text type="secondary">
                        Mặc định dùng 1 loại sản phẩm. Bật công tắc để thêm
                        nhiều phân loại, mỗi loại có giá vốn và giá bán riêng.
                      </Typography.Text>
                    </Space>
                    <Form.Item
                      name="has_variants"
                      valuePropName="checked"
                      noStyle
                    >
                      <Switch
                        checkedChildren="Bật"
                        unCheckedChildren="Tắt"
                        onChange={(checked) => {
                          if (checked) {
                            const currentVariants =
                              form.getFieldValue("variants") || [];
                            if (currentVariants.length === 0) {
                              form.setFieldValue("variants", [
                                {
                                  variant_name: "Loại mặc định",
                                  cost_price: Number(
                                    form.getFieldValue("cost_price") || 0,
                                  ),
                                  price: Number(
                                    form.getFieldValue("price") || 0,
                                  ),
                                  image_url: "",
                                  sort_order: 1,
                                  is_active: true,
                                },
                              ]);
                            }
                            return;
                          }
                          form.setFieldValue("variants", []);
                        }}
                      />
                    </Form.Item>
                  </Space>
                </Card>

                <Divider style={{ marginTop: 8, marginBottom: 16 }}>
                  Phân loại sản phẩm
                </Divider>

                <Typography.Text
                  type="secondary"
                  style={{ display: "block", marginBottom: 12 }}
                >
                  Giá vốn/giá bán theo loại chỉ áp dụng khi bật phân loại. Giảm
                  giá và thời gian hiệu lực dùng chung cho toàn bộ sản phẩm.
                </Typography.Text>

                {hasVariants && (
                  <Form.List name="variants">
                    {(fields, { add, remove }) => (
                      <Space
                        orientation="vertical"
                        size={12}
                        style={{ width: "100%", marginBottom: 16 }}
                      >
                        {fields.map(({ key, name, ...restField }, index) => {
                          const currentImage = variantsValue?.[name]?.image_url;
                          return (
                            <Card
                              key={key}
                              size="small"
                              title={`Loại #${index + 1}`}
                              extra={
                                <Button
                                  danger
                                  type="link"
                                  onClick={() => remove(name)}
                                >
                                  Xóa
                                </Button>
                              }
                            >
                              <div
                                style={{
                                  display: "grid",
                                  gridTemplateColumns:
                                    "repeat(auto-fit, minmax(160px, 1fr))",
                                  gap: 12,
                                }}
                              >
                                <Form.Item
                                  {...restField}
                                  name={[name, "variant_name"]}
                                  label="Tên loại"
                                  rules={[
                                    {
                                      required: true,
                                      message: "Nhập tên loại",
                                    },
                                  ]}
                                >
                                  <Input placeholder="Ví dụ: Màu trắng / 1.8L" />
                                </Form.Item>

                                <Form.Item
                                  {...restField}
                                  name={[name, "cost_price"]}
                                  label="Giá vốn"
                                  rules={[
                                    { required: true, message: "Nhập giá vốn" },
                                    {
                                      type: "number",
                                      min: 0,
                                      message: "Giá vốn không được âm",
                                    },
                                  ]}
                                >
                                  <InputNumber
                                    style={{ width: "100%" }}
                                    placeholder="0"
                                    formatter={(value) =>
                                      `${value}`.replace(
                                        /\B(?=(\d{3})+(?!\d))/g,
                                        ",",
                                      )
                                    }
                                    parser={(value) =>
                                      value!.replace(/\$\s?|(,*)/g, "")
                                    }
                                  />
                                </Form.Item>

                                <Form.Item
                                  {...restField}
                                  name={[name, "price"]}
                                  label="Giá bán"
                                  rules={[
                                    { required: true, message: "Nhập giá bán" },
                                    {
                                      type: "number",
                                      min: 0,
                                      message: "Giá không được âm",
                                    },
                                    {
                                      validator(_, value) {
                                        const variantCostPrice = Number(
                                          form.getFieldValue([
                                            "variants",
                                            name,
                                            "cost_price",
                                          ]) || 0,
                                        );
                                        if (
                                          value === undefined ||
                                          value === null ||
                                          value >= variantCostPrice
                                        ) {
                                          return Promise.resolve();
                                        }
                                        return Promise.reject(
                                          new Error(
                                            "Giá bán phải lớn hơn hoặc bằng giá vốn",
                                          ),
                                        );
                                      },
                                    },
                                  ]}
                                >
                                  <InputNumber
                                    style={{ width: "100%" }}
                                    placeholder="0"
                                    formatter={(value) =>
                                      `${value}`.replace(
                                        /\B(?=(\d{3})+(?!\d))/g,
                                        ",",
                                      )
                                    }
                                    parser={(value) =>
                                      value!.replace(/\$\s?|(,*)/g, "")
                                    }
                                  />
                                </Form.Item>

                                <Form.Item
                                  {...restField}
                                  name={[name, "sort_order"]}
                                  label="Thứ tự"
                                >
                                  <InputNumber
                                    style={{ width: "100%" }}
                                    min={1}
                                    placeholder={`${index + 1}`}
                                  />
                                </Form.Item>
                              </div>

                              <Form.Item
                                {...restField}
                                name={[name, "image_url"]}
                                hidden
                              >
                                <Input />
                              </Form.Item>

                              <div
                                style={{
                                  display: "flex",
                                  alignItems: "center",
                                  gap: 10,
                                  flexWrap: "wrap",
                                }}
                              >
                                <Button
                                  onClick={() =>
                                    setVariantImagePickerIndex(name)
                                  }
                                  disabled={mediaImageOptions.length === 0}
                                >
                                  Chọn ảnh từ media
                                </Button>

                                <Button
                                  type="link"
                                  danger
                                  onClick={() =>
                                    form.setFieldValue(
                                      ["variants", name, "image_url"],
                                      null,
                                    )
                                  }
                                >
                                  Xóa ảnh
                                </Button>

                                {currentImage ? (
                                  <Image
                                    src={currentImage}
                                    alt="variant"
                                    width={44}
                                    height={44}
                                    style={{
                                      objectFit: "cover",
                                      borderRadius: 8,
                                    }}
                                  />
                                ) : (
                                  <Typography.Text type="secondary">
                                    Chưa chọn ảnh
                                  </Typography.Text>
                                )}
                              </div>
                            </Card>
                          );
                        })}

                        <Button
                          type="dashed"
                          block
                          onClick={() =>
                            add({
                              variant_name: "",
                              cost_price: 0,
                              price: 0,
                              image_url: "",
                              sort_order: fields.length + 1,
                              is_active: true,
                            })
                          }
                        >
                          Thêm loại sản phẩm
                        </Button>
                      </Space>
                    )}
                  </Form.List>
                )}

                {!isEditMode ? (
                  <Card
                    title="Media sản phẩm"
                    style={{ marginBottom: 16 }}
                    styles={{ body: { paddingTop: 12 } }}
                  >
                    <Space
                      orientation="vertical"
                      size={12}
                      style={{ width: "100%" }}
                    >
                      <Alert
                        type="info"
                        showIcon
                        message="Chọn ảnh/video ngay khi tạo sản phẩm"
                        description="Sau khi bấm Tạo sản phẩm, hệ thống sẽ tự upload các file này và chuyển sang trang chỉnh sửa để bạn kiểm tra, sắp xếp hoặc đặt lại ảnh bìa nếu cần."
                      />

                      <div>
                        <input
                          id="new-product-media"
                          type="file"
                          multiple
                          accept="image/jpeg,image/jpg,image/png,image/webp,video/mp4,video/webm,video/quicktime"
                          className="hidden"
                          onChange={(event) => {
                            handlePendingMediaSelect(event.target.files);
                            event.target.value = "";
                          }}
                        />
                        <label
                          htmlFor="new-product-media"
                          className="flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed border-gray-300 bg-white p-6 text-center transition hover:border-blue-400 hover:bg-blue-50"
                        >
                          <Typography.Text strong>
                            Chọn ảnh/video sản phẩm
                          </Typography.Text>
                          <Typography.Text
                            type="secondary"
                            style={{ marginTop: 4 }}
                          >
                            JPG, PNG, WEBP ≤10MB • MP4, MOV, WEBM ≤100MB • tối
                            đa 10 file
                          </Typography.Text>
                        </label>
                      </div>

                      {pendingMediaFiles.length > 0 ? (
                        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                          {pendingMediaFiles.map((item, index) => (
                            <div
                              key={item.id}
                              className="overflow-hidden rounded-lg border border-gray-200 bg-white"
                            >
                              <div className="relative aspect-square bg-gray-100">
                                {item.mediaType === "video" ? (
                                  <video
                                    src={item.preview}
                                    className="h-full w-full object-cover"
                                  />
                                ) : (
                                  <Image
                                    src={item.preview}
                                    alt={item.file.name}
                                    preview={false}
                                    style={{
                                      height: "100%",
                                      width: "100%",
                                      objectFit: "cover",
                                    }}
                                  />
                                )}
                                {item.id === coverPendingMediaId &&
                                item.mediaType === "image" ? (
                                  <span className="absolute left-2 top-2 rounded bg-purple-600 px-2 py-1 text-xs font-semibold text-white">
                                    Ảnh bìa
                                  </span>
                                ) : null}
                              </div>
                              <div className="space-y-2 p-2">
                                <Typography.Text
                                  ellipsis
                                  style={{ display: "block", fontSize: 12 }}
                                >
                                  {item.file.name}
                                </Typography.Text>
                                <div className="flex items-center justify-between gap-2">
                                  <Typography.Text
                                    type={
                                      item.status === "error"
                                        ? "danger"
                                        : "secondary"
                                    }
                                    style={{ fontSize: 11 }}
                                  >
                                    {item.status === "ready"
                                      ? formatFileSize(item.file.size)
                                      : item.status === "uploading"
                                        ? "Đang upload"
                                        : item.status === "done"
                                          ? "Đã upload"
                                          : item.error || "Lỗi"}
                                  </Typography.Text>
                                  <Button
                                    size="small"
                                    danger
                                    type="link"
                                    disabled={item.status === "uploading"}
                                    onClick={() =>
                                      removePendingMediaFile(item.id)
                                    }
                                  >
                                    Xóa
                                  </Button>
                                </div>
                                <div className="grid grid-cols-3 gap-1">
                                  <Button
                                    size="small"
                                    disabled={index === 0}
                                    onClick={() =>
                                      movePendingMediaFile(item.id, -1)
                                    }
                                  >
                                    Lên
                                  </Button>
                                  <Button
                                    size="small"
                                    disabled={
                                      index === pendingMediaFiles.length - 1
                                    }
                                    onClick={() =>
                                      movePendingMediaFile(item.id, 1)
                                    }
                                  >
                                    Xuống
                                  </Button>
                                  <Button
                                    size="small"
                                    disabled={item.mediaType !== "image"}
                                    type={
                                      item.id === coverPendingMediaId
                                        ? "primary"
                                        : "default"
                                    }
                                    onClick={() =>
                                      setCoverPendingMediaId(item.id)
                                    }
                                  >
                                    Bìa
                                  </Button>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : null}
                    </Space>
                  </Card>
                ) : (
                  <Card
                    title="Media sản phẩm"
                    style={{ marginBottom: 16 }}
                    styles={{ body: { paddingTop: 12 } }}
                  >
                    <Space
                      orientation="vertical"
                      size={16}
                      style={{ width: "100%" }}
                    >
                      <ImageUpload
                        productId={productId || ""}
                        onUploadSuccess={fetchProductMedia}
                        maxFiles={10}
                      />
                      {isLoadingMedia ? (
                        <div style={{ textAlign: "center", padding: 20 }}>
                          <Spin />
                        </div>
                      ) : (
                        <ImageGallery
                          images={productMediaItems}
                          onImagesChange={fetchProductMedia}
                        />
                      )}
                    </Space>
                  </Card>
                )}

                <Form.Item
                  label="Trạng thái"
                  name="is_active"
                  valuePropName="checked"
                >
                  <Switch checkedChildren="Hiển thị" unCheckedChildren="Ẩn" />
                </Form.Item>
              </Form>

              <Divider style={{ margin: "8px 0 0" }} />

              <div style={{ paddingTop: 16 }}>
                {renderSaveActions({ justify: "end" })}
              </div>
            </Card>
          )}
        </Space>
      </div>

      <Modal
        open={variantImagePickerIndex !== null}
        title="Chọn ảnh loại sản phẩm"
        onCancel={() => setVariantImagePickerIndex(null)}
        footer={null}
        width={760}
        destroyOnHidden
      >
        {mediaImageOptions.length === 0 ? (
          <Alert
            type="info"
            showIcon
            title="Chưa có ảnh media cho sản phẩm này"
            description="Vui lòng upload ảnh ở trang media sản phẩm trước, sau đó quay lại chọn ảnh cho loại."
          />
        ) : (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(110px, 1fr))",
              gap: 12,
            }}
          >
            {mediaImageOptions.map((item) => (
              <button
                key={item.value}
                type="button"
                onClick={() => {
                  if (variantImagePickerIndex === null) return;
                  form.setFieldValue(
                    ["variants", variantImagePickerIndex, "image_url"],
                    item.value,
                  );
                  setVariantImagePickerIndex(null);
                }}
                style={{
                  border: "1px solid #d9d9d9",
                  borderRadius: 10,
                  padding: 6,
                  textAlign: "left",
                  background: "#fff",
                }}
              >
                <Image
                  src={item.value}
                  alt={item.label}
                  width={96}
                  height={96}
                  preview={false}
                  style={{
                    width: "100%",
                    height: 96,
                    objectFit: "cover",
                    borderRadius: 8,
                  }}
                />
                <div
                  style={{
                    marginTop: 6,
                    fontSize: 12,
                    color: "#595959",
                    lineHeight: 1.3,
                  }}
                >
                  {item.label}
                </div>
              </button>
            ))}
          </div>
        )}
      </Modal>
    </div>
  );
}
