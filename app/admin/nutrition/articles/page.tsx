"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Button,
  Card,
  Form,
  Image,
  Input,
  Modal,
  Popconfirm,
  Select,
  Space,
  Table,
  Tag,
  Typography,
  message,
} from "antd";
import type { ColumnsType } from "antd/es/table";
import {
  DeleteOutlined,
  EditOutlined,
  EyeOutlined,
  PlusOutlined,
  ReloadOutlined,
} from "@ant-design/icons";
import Link from "next/link";
import { RichTextEditor } from "@/components/admin/RichTextEditor";
import type {
  NutritionArticle,
  NutritionArticleStatus,
  NutritionCategory,
  Product,
} from "@/types/database";

type ArticleRow = NutritionArticle & {
  nutrition_categories?: NutritionCategory | null;
};

interface ArticleFormValues {
  title: string;
  slug?: string;
  excerpt?: string;
  content?: string;
  coverImageUrl?: string;
  categoryId?: string;
  authorName?: string;
  status: NutritionArticleStatus;
  relatedProductIds?: string[];
}

const statusOptions: Array<{ label: string; value: NutritionArticleStatus }> = [
  { label: "Bản nháp", value: "draft" },
  { label: "Đã xuất bản", value: "published" },
  { label: "Lưu trữ", value: "archived" },
];

function getStatusTag(status: NutritionArticleStatus) {
  if (status === "published") return <Tag color="success">Đã xuất bản</Tag>;
  if (status === "archived") return <Tag color="default">Lưu trữ</Tag>;
  return <Tag color="gold">Bản nháp</Tag>;
}

export default function NutritionArticlesAdminPage() {
  const [form] = Form.useForm<ArticleFormValues>();
  const [categoryForm] = Form.useForm<{ name: string; description?: string }>();
  const [messageApi, contextHolder] = message.useMessage();
  const [articles, setArticles] = useState<ArticleRow[]>([]);
  const [categories, setCategories] = useState<NutritionCategory[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isCategorySubmitting, setIsCategorySubmitting] = useState(false);
  const [editingArticle, setEditingArticle] = useState<ArticleRow | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const editorContent = Form.useWatch("content", form) || "";

  const fetchArticles = useCallback(async (signal?: AbortSignal) => {
    setIsRefreshing(true);
    try {
      const params = new URLSearchParams();
      if (statusFilter !== "all") params.set("status", statusFilter);
      if (debouncedSearch) params.set("search", debouncedSearch);
      const response = await fetch(
        `/api/admin/nutrition/articles?${params.toString()}`,
        { cache: "no-store", signal },
      );
      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.error || "Không thể tải bài viết");
      }
      if (signal?.aborted) return;
      setArticles(Array.isArray(result.articles) ? result.articles : []);
    } catch (error: unknown) {
      if (signal?.aborted) return;
      messageApi.error(
        error instanceof Error ? error.message : "Không thể tải bài viết",
      );
    } finally {
      if (!signal?.aborted) {
        setIsLoading(false);
        setIsRefreshing(false);
      }
    }
  }, [debouncedSearch, messageApi, statusFilter]);

  const fetchSupportingData = useCallback(async () => {
    try {
      const [categoriesRes, productsRes] = await Promise.all([
        fetch("/api/admin/nutrition/categories", { cache: "no-store" }),
        fetch(`/api/products?activeOnly=true&noCache=1&t=${Date.now()}`, {
          cache: "no-store",
        }),
      ]);
      const [categoriesData, productsData] = await Promise.all([
        categoriesRes.json(),
        productsRes.json(),
      ]);
      if (categoriesRes.ok) {
        setCategories(
          Array.isArray(categoriesData.categories)
            ? categoriesData.categories
            : [],
        );
      }
      if (productsRes.ok) {
        setProducts(Array.isArray(productsData) ? productsData : []);
      }
    } catch (error) {
      console.error("Error loading nutrition article support data:", error);
    }
  }, []);

  useEffect(() => {
    const timeoutId = window.setTimeout(
      () => setDebouncedSearch(search.trim()),
      300,
    );
    return () => window.clearTimeout(timeoutId);
  }, [search]);

  useEffect(() => {
    const controller = new AbortController();
    fetchArticles(controller.signal);
    return () => controller.abort();
  }, [fetchArticles]);

  useEffect(() => {
    fetchSupportingData();
  }, [fetchSupportingData]);

  const categoryOptions = useMemo(
    () =>
      categories.map((item) => ({
        label: item.name,
        value: item.id,
      })),
    [categories],
  );

  const productOptions = useMemo(
    () =>
      products.map((item) => ({
        label: `${item.name} - ${item.category}`,
        value: item.id,
      })),
    [products],
  );

  const openCreateModal = () => {
    setEditingArticle(null);
    form.resetFields();
    form.setFieldsValue({
      status: "draft",
      authorName: "Bác sĩ dinh dưỡng",
      content: "",
      relatedProductIds: [],
    });
    setIsModalOpen(true);
  };

  const openEditModal = async (article: ArticleRow) => {
    try {
      const response = await fetch(`/api/admin/nutrition/articles/${article.id}`);
      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.error || "Không thể tải bài viết");
      }
      const loadedArticle = result.article as ArticleRow;
      setEditingArticle(loadedArticle);
      form.setFieldsValue({
        title: loadedArticle.title,
        slug: loadedArticle.slug,
        excerpt: loadedArticle.excerpt || undefined,
        content: loadedArticle.content || "",
        coverImageUrl: loadedArticle.cover_image_url || undefined,
        categoryId: loadedArticle.category_id || undefined,
        authorName: loadedArticle.author_name || undefined,
        status: loadedArticle.status,
        relatedProductIds: loadedArticle.related_product_ids || [],
      });
      setIsModalOpen(true);
    } catch (error: unknown) {
      messageApi.error(
        error instanceof Error ? error.message : "Không thể tải bài viết",
      );
    }
  };

  const handleSubmit = async (values: ArticleFormValues) => {
    setIsSubmitting(true);
    try {
      const payload = {
        title: values.title,
        slug: values.slug,
        excerpt: values.excerpt,
        content: values.content || "",
        coverImageUrl: values.coverImageUrl,
        categoryId: values.categoryId,
        authorName: values.authorName,
        status: values.status,
        relatedProductIds: values.relatedProductIds || [],
      };
      const response = await fetch(
        editingArticle
          ? `/api/admin/nutrition/articles/${editingArticle.id}`
          : "/api/admin/nutrition/articles",
        {
          method: editingArticle ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        },
      );
      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.error || "Không thể lưu bài viết");
      }

      messageApi.success(result.message || "Đã lưu bài viết");
      setIsModalOpen(false);
      form.resetFields();
      await fetchArticles();
    } catch (error: unknown) {
      messageApi.error(
        error instanceof Error ? error.message : "Không thể lưu bài viết",
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      const response = await fetch(`/api/admin/nutrition/articles/${id}`, {
        method: "DELETE",
      });
      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.error || "Không thể xóa bài viết");
      }
      messageApi.success("Đã xóa bài viết");
      await fetchArticles();
    } catch (error: unknown) {
      messageApi.error(
        error instanceof Error ? error.message : "Không thể xóa bài viết",
      );
    }
  };

  const handleCreateCategory = async (values: {
    name: string;
    description?: string;
  }) => {
    setIsCategorySubmitting(true);
    try {
      const response = await fetch("/api/admin/nutrition/categories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });
      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.error || "Không thể tạo danh mục");
      }
      messageApi.success(result.message || "Đã tạo danh mục");
      setIsCategoryModalOpen(false);
      categoryForm.resetFields();
      await fetchSupportingData();
    } catch (error: unknown) {
      messageApi.error(
        error instanceof Error ? error.message : "Không thể tạo danh mục",
      );
    } finally {
      setIsCategorySubmitting(false);
    }
  };

  const columns: ColumnsType<ArticleRow> = [
    {
      title: "Bài viết",
      key: "article",
      width: 360,
      render: (_value, record) => (
        <Space size={12} align="start" style={{ maxWidth: "100%" }}>
          {record.cover_image_url ? (
            <Image
              src={record.cover_image_url}
              alt={record.title}
              width={72}
              height={48}
              preview={false}
              style={{ objectFit: "cover", borderRadius: 6, flexShrink: 0 }}
            />
          ) : (
            <div
              style={{
                width: 72,
                height: 48,
                borderRadius: 6,
                background: "#f0f0f0",
                display: "grid",
                placeItems: "center",
                color: "#8c8c8c",
                fontSize: 12,
              }}
            >
              No image
            </div>
          )}
          <div style={{ minWidth: 0 }}>
            <Typography.Text strong ellipsis style={{ maxWidth: 240 }}>
              {record.title}
            </Typography.Text>
            <div>
              <Typography.Text
                type="secondary"
                style={{ fontSize: 12, wordBreak: "break-word" }}
              >
                /nutrition/{record.slug}
              </Typography.Text>
            </div>
          </div>
        </Space>
      ),
    },
    {
      title: "Danh mục",
      key: "category",
      width: 180,
      render: (_value, record) =>
        record.nutrition_categories ? (
          <Tag color="green">{record.nutrition_categories.name}</Tag>
        ) : (
          <Tag>Chưa phân loại</Tag>
        ),
    },
    {
      title: "Trạng thái",
      dataIndex: "status",
      key: "status",
      width: 130,
      render: (value: NutritionArticleStatus) => getStatusTag(value),
    },
    {
      title: "Cập nhật",
      dataIndex: "updated_at",
      key: "updated_at",
      width: 160,
      render: (value: string) => new Date(value).toLocaleString("vi-VN"),
    },
    {
      title: "Thao tác",
      key: "actions",
      width: 180,
      render: (_value, record) => (
        <Space>
          {record.status === "published" && (
            <Link href={`/nutrition/${record.slug}`} target="_blank">
              <Button size="small" icon={<EyeOutlined />} />
            </Link>
          )}
          <Button
            size="small"
            icon={<EditOutlined />}
            onClick={() => openEditModal(record)}
          />
          <Popconfirm
            title="Xóa bài viết này?"
            okText="Xóa"
            cancelText="Hủy"
            okButtonProps={{ danger: true }}
            onConfirm={() => handleDelete(record.id)}
          >
            <Button size="small" danger icon={<DeleteOutlined />} />
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#f5f5f5",
        padding: 12,
        maxWidth: "100%",
        overflowX: "hidden",
      }}
    >
      {contextHolder}

      <Card>
        <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <Typography.Title level={3} style={{ margin: 0 }}>
              Bài viết dinh dưỡng
            </Typography.Title>
            <Typography.Text
              type="secondary"
              className="md:hidden"
              style={{ display: "block", marginTop: 4 }}
            >
              Trên điện thoại chỉ nên xem, lọc và chỉnh nhanh. Soạn bài đầy đủ
              nên dùng desktop.
            </Typography.Text>
          </div>
          <Space wrap className="w-full lg:w-auto">
            <Button
              icon={<ReloadOutlined spin={isRefreshing} />}
              loading={isRefreshing}
              onClick={() => {
                setIsRefreshing(true);
                fetchArticles();
              }}
            >
              Làm mới
            </Button>
            <Button onClick={() => setIsCategoryModalOpen(true)}>
              Tạo danh mục
            </Button>
            <Button type="primary" icon={<PlusOutlined />} onClick={openCreateModal}>
              Tạo bài viết
            </Button>
          </Space>
        </div>

        <Space
          wrap
          style={{ marginBottom: 16, width: "100%" }}
          className="admin-articles-filter"
        >
          <Input.Search
            allowClear
            placeholder="Tìm tiêu đề"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            style={{ width: "min(280px, 100%)" }}
          />
          <Select
            value={statusFilter}
            onChange={setStatusFilter}
            style={{ width: "min(180px, 100%)" }}
            options={[{ label: "Tất cả", value: "all" }, ...statusOptions]}
          />
        </Space>

        <Table
          rowKey="id"
          loading={isLoading || isRefreshing}
          dataSource={articles}
          columns={columns}
          pagination={{ pageSize: 10 }}
          scroll={{ x: 960 }}
        />
      </Card>

      <Modal
        title={editingArticle ? "Sửa bài viết" : "Tạo bài viết"}
        open={isModalOpen}
        onCancel={() => setIsModalOpen(false)}
        onOk={() => form.submit()}
        confirmLoading={isSubmitting}
        okText="Lưu"
        cancelText="Hủy"
        width="min(980px, calc(100vw - 24px))"
        style={{ top: 12 }}
        styles={{
          body: {
            maxHeight: "calc(100dvh - 190px)",
            overflowY: "auto",
            overflowX: "hidden",
          },
        }}
        destroyOnHidden
      >
        <div className="mb-3 rounded-md border border-amber-200 bg-amber-50 p-3 md:hidden">
          <Typography.Text type="secondary">
            Soạn nội dung dài và chèn media sẽ thuận tiện hơn trên desktop.
          </Typography.Text>
        </div>
        <Form<ArticleFormValues>
          form={form}
          layout="vertical"
          onFinish={handleSubmit}
        >
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <Form.Item
              name="title"
              label="Tiêu đề"
              rules={[
                { required: true, message: "Vui lòng nhập tiêu đề" },
                { min: 5, message: "Tiêu đề tối thiểu 5 ký tự" },
              ]}
            >
              <Input placeholder="Ví dụ: Cách xây dựng bữa sáng lành mạnh" />
            </Form.Item>

            <Form.Item name="slug" label="Slug tùy chỉnh">
              <Input placeholder="tu-dong-tao-neu-bo-trong" />
            </Form.Item>

            <Form.Item name="categoryId" label="Danh mục">
              <Select
                allowClear
                placeholder="Chọn danh mục"
                options={categoryOptions}
              />
            </Form.Item>

            <Form.Item name="status" label="Trạng thái" initialValue="draft">
              <Select options={statusOptions} />
            </Form.Item>

            <Form.Item name="authorName" label="Tác giả">
              <Input placeholder="Bác sĩ dinh dưỡng" />
            </Form.Item>

            <Form.Item name="coverImageUrl" label="Ảnh đại diện URL">
              <Input placeholder="https://..." />
            </Form.Item>
          </div>

          <Form.Item name="excerpt" label="Tóm tắt">
            <Input.TextArea
              rows={3}
              placeholder="Một đoạn ngắn hiển thị trên danh sách bài viết"
            />
          </Form.Item>

          <Form.Item name="relatedProductIds" label="Sản phẩm liên quan">
            <Select
              mode="multiple"
              allowClear
              showSearch
              placeholder="Chọn sản phẩm gợi ý trong bài"
              options={productOptions}
              filterOption={(input, option) =>
                String(option?.label || "")
                  .toLowerCase()
                  .includes(input.toLowerCase())
              }
            />
          </Form.Item>

          <Form.Item name="content" hidden>
            <Input />
          </Form.Item>

          <Form.Item label="Nội dung bài viết" required>
            <RichTextEditor
              value={editorContent}
              onChange={(value) => form.setFieldValue("content", value)}
              placeholder="Nhập nội dung bài viết dinh dưỡng..."
              minHeight={280}
            />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title="Tạo danh mục dinh dưỡng"
        open={isCategoryModalOpen}
        onCancel={() => setIsCategoryModalOpen(false)}
        onOk={() => categoryForm.submit()}
        confirmLoading={isCategorySubmitting}
        okText="Tạo"
        cancelText="Hủy"
        width="min(520px, calc(100vw - 24px))"
        style={{ top: 24 }}
      >
        <Form
          form={categoryForm}
          layout="vertical"
          onFinish={handleCreateCategory}
        >
          <Form.Item
            name="name"
            label="Tên danh mục"
            rules={[
              { required: true, message: "Vui lòng nhập tên danh mục" },
              { min: 2, message: "Tên danh mục tối thiểu 2 ký tự" },
            ]}
          >
            <Input placeholder="Ví dụ: Giảm cân lành mạnh" />
          </Form.Item>
          <Form.Item name="description" label="Mô tả">
            <Input.TextArea rows={3} />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
