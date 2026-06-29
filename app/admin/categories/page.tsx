"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { Key } from "react";
import {
  Alert,
  Button,
  Card,
  Form,
  Input,
  Modal,
  Popconfirm,
  Select,
  Space,
  Table,
  Tag,
  Tooltip,
  Typography,
  message,
} from "antd";
import {
  DeleteOutlined,
  EditOutlined,
  MergeCellsOutlined,
  PlusOutlined,
  ReloadOutlined,
  SearchOutlined,
} from "@ant-design/icons";

interface CategoryItem {
  id: string;
  name: string;
  slug: string;
  is_active: boolean;
  product_count: number;
}

type UsageFilter = "all" | "used" | "unused";
type ActivityFilter = "all" | "active" | "inactive";

interface NameFormValues {
  name: string;
}

async function readApiResponse(response: Response) {
  const result = await response.json();
  if (!response.ok) {
    throw new Error(result.error || "Thao tác không thành công");
  }
  return result;
}

export default function CategoriesPage() {
  const [messageApi, contextHolder] = message.useMessage();
  const [categories, setCategories] = useState<CategoryItem[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [usageFilter, setUsageFilter] = useState<UsageFilter>("all");
  const [activityFilter, setActivityFilter] =
    useState<ActivityFilter>("all");
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isMergeOpen, setIsMergeOpen] = useState(false);
  const [editingCategory, setEditingCategory] =
    useState<CategoryItem | null>(null);
  const [createForm] = Form.useForm<NameFormValues>();
  const [editForm] = Form.useForm<NameFormValues>();
  const [mergeForm] = Form.useForm<NameFormValues>();

  const fetchCategories = useCallback(async () => {
    try {
      const response = await fetch("/api/admin/categories");
      const result = await readApiResponse(response);
      const nextCategories = Array.isArray(result.categories)
        ? result.categories
        : [];

      setCategories(nextCategories);
      setSelectedIds((currentIds) =>
        currentIds.filter((id) =>
          nextCategories.some((category: CategoryItem) => category.id === id),
        ),
      );
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : "Không thể tải danh mục";
      messageApi.error(errorMessage);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [messageApi]);

  useEffect(() => {
    fetchCategories();
  }, [fetchCategories]);

  const selectedCategories = useMemo(
    () => categories.filter((category) => selectedIds.includes(category.id)),
    [categories, selectedIds],
  );

  const selectedUsedCount = useMemo(
    () =>
      selectedCategories.filter((category) => category.product_count > 0)
        .length,
    [selectedCategories],
  );

  const filteredCategories = useMemo(() => {
    const keyword = searchTerm.trim().toLocaleLowerCase("vi");

    return categories.filter((category) => {
      const matchesKeyword =
        !keyword ||
        category.name.toLocaleLowerCase("vi").includes(keyword) ||
        category.slug.toLowerCase().includes(keyword);
      const matchesUsage =
        usageFilter === "all" ||
        (usageFilter === "used" && category.product_count > 0) ||
        (usageFilter === "unused" && category.product_count === 0);
      const matchesActivity =
        activityFilter === "all" ||
        (activityFilter === "active" && category.is_active) ||
        (activityFilter === "inactive" && !category.is_active);

      return matchesKeyword && matchesUsage && matchesActivity;
    });
  }, [activityFilter, categories, searchTerm, usageFilter]);

  const stats = useMemo(() => {
    const total = categories.length;
    const used = categories.filter((item) => item.product_count > 0).length;
    return { total, used, unused: total - used };
  }, [categories]);

  const handleCreate = async (values: NameFormValues) => {
    setIsSubmitting(true);
    try {
      const response = await fetch("/api/admin/categories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });
      await readApiResponse(response);

      messageApi.success("Tạo danh mục thành công");
      setIsCreateOpen(false);
      createForm.resetFields();
      await fetchCategories();
    } catch (error: unknown) {
      messageApi.error(
        error instanceof Error ? error.message : "Không thể tạo danh mục",
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const openEditModal = (category: CategoryItem) => {
    setEditingCategory(category);
    editForm.setFieldsValue({ name: category.name });
    setIsEditOpen(true);
  };

  const handleEdit = async (values: NameFormValues) => {
    if (!editingCategory) return;

    setIsSubmitting(true);
    try {
      const response = await fetch("/api/admin/categories", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "update",
          id: editingCategory.id,
          name: values.name,
        }),
      });
      const result = await readApiResponse(response);

      messageApi.success(
        result.updated_products > 0
          ? `Đã đổi tên và cập nhật ${result.updated_products} sản phẩm`
          : "Đã cập nhật danh mục",
      );
      setIsEditOpen(false);
      setEditingCategory(null);
      editForm.resetFields();
      await fetchCategories();
    } catch (error: unknown) {
      messageApi.error(
        error instanceof Error ? error.message : "Không thể sửa danh mục",
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const openMergeModal = () => {
    if (selectedCategories.length < 2) return;

    const uniqueNames = new Set(
      selectedCategories.map((category) =>
        category.name.trim().toLocaleLowerCase("vi"),
      ),
    );
    mergeForm.setFieldsValue({
      name: uniqueNames.size === 1 ? selectedCategories[0].name : "",
    });
    setIsMergeOpen(true);
  };

  const handleMerge = async (values: NameFormValues) => {
    setIsSubmitting(true);
    try {
      const response = await fetch("/api/admin/categories", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "merge",
          ids: selectedIds,
          name: values.name,
        }),
      });
      const result = await readApiResponse(response);

      messageApi.success(
        `Đã gộp ${result.merged_categories} danh mục và cập nhật ${result.updated_products} sản phẩm`,
      );
      setIsMergeOpen(false);
      setSelectedIds([]);
      mergeForm.resetFields();
      await fetchCategories();
    } catch (error: unknown) {
      messageApi.error(
        error instanceof Error ? error.message : "Không thể gộp danh mục",
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (ids: string[]) => {
    setIsSubmitting(true);
    try {
      const response = await fetch("/api/admin/categories", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids }),
      });
      const result = await readApiResponse(response);

      messageApi.success(`Đã xóa ${result.deleted_categories} danh mục`);
      setSelectedIds((currentIds) =>
        currentIds.filter((id) => !ids.includes(id)),
      );
      await fetchCategories();
    } catch (error: unknown) {
      messageApi.error(
        error instanceof Error ? error.message : "Không thể xóa danh mục",
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const nameRules = [
    { required: true, message: "Vui lòng nhập tên danh mục" },
    { min: 2, message: "Tên danh mục tối thiểu 2 ký tự" },
    { max: 100, message: "Tên danh mục tối đa 100 ký tự" },
  ];

  return (
    <div style={{ minHeight: "100vh", background: "#f5f5f5", padding: 24 }}>
      {contextHolder}

      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: 12,
          marginBottom: 16,
        }}
      >
        <div>
          <h1 style={{ margin: 0, fontSize: 28, fontWeight: 700 }}>
            Quản lý danh mục
          </h1>
          <p style={{ margin: "4px 0 0", color: "#8c8c8c" }}>
            Một sản phẩm có thể thuộc nhiều danh mục
          </p>
        </div>

        <Space wrap>
          <Button
            icon={<ReloadOutlined spin={isRefreshing} />}
            onClick={() => {
              setIsRefreshing(true);
              fetchCategories();
            }}
            loading={isRefreshing}
          >
            Làm mới
          </Button>
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={() => setIsCreateOpen(true)}
          >
            Tạo danh mục
          </Button>
        </Space>
      </div>

      <Space size={16} wrap style={{ marginBottom: 16 }}>
        <Tag color="blue">Tổng: {stats.total}</Tag>
        <Tag color="green">Đang dùng: {stats.used}</Tag>
        <Tag>Chưa dùng: {stats.unused}</Tag>
      </Space>

      <Card>
        <Space
          wrap
          size={12}
          style={{
            width: "100%",
            justifyContent: "space-between",
            marginBottom: 16,
          }}
        >
          <Space wrap>
            <Input
              allowClear
              prefix={<SearchOutlined />}
              placeholder="Tìm theo tên hoặc slug"
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              style={{ width: 260 }}
            />
            <Select<UsageFilter>
              value={usageFilter}
              onChange={setUsageFilter}
              style={{ width: 150 }}
              options={[
                { value: "all", label: "Tất cả sử dụng" },
                { value: "used", label: "Đang dùng" },
                { value: "unused", label: "Chưa dùng" },
              ]}
            />
            <Select<ActivityFilter>
              value={activityFilter}
              onChange={setActivityFilter}
              style={{ width: 150 }}
              options={[
                { value: "all", label: "Tất cả trạng thái" },
                { value: "active", label: "Hoạt động" },
                { value: "inactive", label: "Đang ẩn" },
              ]}
            />
          </Space>

          <Space wrap>
            <Typography.Text type="secondary">
              Đã chọn: {selectedIds.length}
            </Typography.Text>
            <Button
              icon={<MergeCellsOutlined />}
              disabled={selectedIds.length < 2}
              onClick={openMergeModal}
            >
              Gộp danh mục
            </Button>
            <Tooltip
              title={
                selectedUsedCount > 0
                  ? "Danh mục đang dùng cần được gộp trước khi xóa"
                  : undefined
              }
            >
              <span>
                <Popconfirm
                  title={`Xóa ${selectedIds.length} danh mục?`}
                  description="Thao tác này không thể hoàn tác."
                  onConfirm={() => handleDelete(selectedIds)}
                  okText="Xóa"
                  cancelText="Hủy"
                  okButtonProps={{ danger: true, loading: isSubmitting }}
                  disabled={
                    selectedIds.length === 0 || selectedUsedCount > 0
                  }
                >
                  <Button
                    danger
                    icon={<DeleteOutlined />}
                    disabled={
                      selectedIds.length === 0 || selectedUsedCount > 0
                    }
                  >
                    Xóa đã chọn
                  </Button>
                </Popconfirm>
              </span>
            </Tooltip>
          </Space>
        </Space>

        <Table<CategoryItem>
          rowKey="id"
          loading={isLoading}
          dataSource={filteredCategories}
          scroll={{ x: 900 }}
          rowSelection={{
            selectedRowKeys: selectedIds,
            preserveSelectedRowKeys: true,
            onChange: (keys: Key[]) =>
              setSelectedIds(keys.map((key) => String(key))),
          }}
          pagination={{
            pageSize: 20,
            showSizeChanger: true,
            showTotal: (total) => `${total} danh mục`,
          }}
          columns={[
            {
              title: "Tên danh mục",
              dataIndex: "name",
              key: "name",
              sorter: (first, second) =>
                first.name.localeCompare(second.name, "vi"),
            },
            {
              title: "Slug",
              dataIndex: "slug",
              key: "slug",
              responsive: ["md"],
            },
            {
              title: "Số sản phẩm",
              dataIndex: "product_count",
              key: "product_count",
              align: "center",
              sorter: (first, second) =>
                first.product_count - second.product_count,
            },
            {
              title: "Trạng thái",
              dataIndex: "is_active",
              key: "is_active",
              render: (value: boolean) => (
                <Tag color={value ? "success" : "default"}>
                  {value ? "Hoạt động" : "Ẩn"}
                </Tag>
              ),
            },
            {
              title: "Hành động",
              key: "action",
              align: "center",
              render: (_: unknown, record: CategoryItem) => (
                <Space>
                  <Tooltip title="Sửa tên danh mục">
                    <Button
                      type="text"
                      size="small"
                      icon={<EditOutlined />}
                      onClick={() => openEditModal(record)}
                    />
                  </Tooltip>
                  <Tooltip
                    title={
                      record.product_count > 0
                        ? "Hãy gộp danh mục đang dùng trước khi xóa"
                        : "Xóa danh mục"
                    }
                  >
                    <span>
                      <Popconfirm
                        title="Xóa danh mục?"
                        description="Thao tác này không thể hoàn tác."
                        onConfirm={() => handleDelete([record.id])}
                        okText="Xóa"
                        cancelText="Hủy"
                        okButtonProps={{ danger: true }}
                        disabled={record.product_count > 0}
                      >
                        <Button
                          type="text"
                          danger
                          size="small"
                          icon={<DeleteOutlined />}
                          disabled={record.product_count > 0}
                        />
                      </Popconfirm>
                    </span>
                  </Tooltip>
                </Space>
              ),
            },
          ]}
        />
      </Card>

      <Modal
        title="Tạo danh mục mới"
        open={isCreateOpen}
        onCancel={() => {
          setIsCreateOpen(false);
          createForm.resetFields();
        }}
        onOk={() => createForm.submit()}
        confirmLoading={isSubmitting}
        okText="Tạo"
        cancelText="Hủy"
        destroyOnHidden
      >
        <Form
          form={createForm}
          layout="vertical"
          onFinish={handleCreate}
        >
          <Form.Item label="Tên danh mục" name="name" rules={nameRules}>
            <Input placeholder="Ví dụ: Sữa dinh dưỡng" />
          </Form.Item>
          <Alert
            type="info"
            showIcon
            message="Slug sẽ được tạo tự động và thêm số nếu đã tồn tại."
          />
        </Form>
      </Modal>

      <Modal
        title="Sửa danh mục"
        open={isEditOpen}
        onCancel={() => {
          setIsEditOpen(false);
          setEditingCategory(null);
          editForm.resetFields();
        }}
        onOk={() => editForm.submit()}
        confirmLoading={isSubmitting}
        okText="Lưu thay đổi"
        cancelText="Hủy"
        destroyOnHidden
      >
        <Form form={editForm} layout="vertical" onFinish={handleEdit}>
          <Form.Item label="Tên danh mục" name="name" rules={nameRules}>
            <Input placeholder="Nhập tên danh mục mới" />
          </Form.Item>
          <Alert
            type="info"
            showIcon
            message="Tên và slug mới sẽ được áp dụng cho toàn bộ sản phẩm đang dùng danh mục này."
          />
        </Form>
      </Modal>

      <Modal
        title={`Gộp ${selectedCategories.length} danh mục`}
        open={isMergeOpen}
        onCancel={() => {
          setIsMergeOpen(false);
          mergeForm.resetFields();
        }}
        onOk={() => mergeForm.submit()}
        confirmLoading={isSubmitting}
        okText="Gộp danh mục"
        cancelText="Hủy"
        destroyOnHidden
      >
        <Alert
          type="warning"
          showIcon
          style={{ marginBottom: 16 }}
          message="Các danh mục cũ sẽ được thay bằng một danh mục duy nhất."
          description="Mọi sản phẩm liên quan được cập nhật tự động; liên kết trùng lặp sẽ được loại bỏ."
        />
        <Typography.Paragraph style={{ marginBottom: 8 }}>
          Danh mục đã chọn:
        </Typography.Paragraph>
        <Space wrap style={{ marginBottom: 16 }}>
          {selectedCategories.map((category) => (
            <Tag key={category.id}>
              {category.name} ({category.product_count})
            </Tag>
          ))}
        </Space>
        <Form form={mergeForm} layout="vertical" onFinish={handleMerge}>
          <Form.Item
            label="Tên danh mục sau khi gộp"
            name="name"
            rules={nameRules}
          >
            <Input placeholder="Nhập tên danh mục thống nhất" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
