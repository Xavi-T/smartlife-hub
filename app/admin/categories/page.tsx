"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Button,
  Card,
  Form,
  Input,
  Modal,
  Popconfirm,
  Space,
  Table,
  Tag,
  message,
} from "antd";
import {
  PlusOutlined,
  ReloadOutlined,
  DeleteOutlined,
} from "@ant-design/icons";

interface CategoryItem {
  id: string;
  name: string;
  slug: string;
  is_active: boolean;
  product_count: number;
}

export default function CategoriesPage() {
  const [messageApi, contextHolder] = message.useMessage();
  const [categories, setCategories] = useState<CategoryItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [form] = Form.useForm();

  const fetchCategories = useCallback(async () => {
    try {
      const response = await fetch("/api/admin/categories");
      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.error || "Không thể tải danh mục");
      }
      setCategories(result.categories || []);
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

  const handleCreate = async (values: { name: string }) => {
    setIsSubmitting(true);
    try {
      const response = await fetch("/api/admin/categories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });
      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.error || "Không thể tạo danh mục");
      }

      messageApi.success("Tạo danh mục thành công");
      setIsCreateOpen(false);
      form.resetFields();
      fetchCategories();
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : "Không thể tạo danh mục";
      messageApi.error(errorMessage);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      const response = await fetch(`/api/admin/categories?id=${id}`, {
        method: "DELETE",
      });
      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.error || "Không thể xóa danh mục");
      }

      messageApi.success("Đã xóa danh mục");
      fetchCategories();
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : "Không thể xóa danh mục";
      messageApi.error(errorMessage);
    }
  };

  const stats = useMemo(() => {
    const total = categories.length;
    const used = categories.filter((item) => item.product_count > 0).length;
    const unused = total - used;
    return { total, used, unused };
  }, [categories]);

  return (
    <div style={{ minHeight: "100vh", background: "#f5f5f5", padding: 24 }}>
      {contextHolder}

      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
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

        <Space>
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

      <Space size={16} style={{ marginBottom: 16 }}>
        <Tag color="blue">Tổng: {stats.total}</Tag>
        <Tag color="green">Đang dùng: {stats.used}</Tag>
        <Tag color="default">Chưa dùng: {stats.unused}</Tag>
      </Space>

      <Card>
        <Table
          rowKey="id"
          loading={isLoading}
          dataSource={categories}
          pagination={{ pageSize: 20 }}
          columns={[
            {
              title: "Tên danh mục",
              dataIndex: "name",
              key: "name",
            },
            {
              title: "Slug",
              dataIndex: "slug",
              key: "slug",
            },
            {
              title: "Số sản phẩm",
              dataIndex: "product_count",
              key: "product_count",
              align: "center",
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
                <Popconfirm
                  title="Xóa danh mục"
                  description="Danh mục đang được sử dụng sẽ không thể xóa"
                  onConfirm={() => handleDelete(record.id)}
                  okText="Xóa"
                  cancelText="Hủy"
                  okButtonProps={{ danger: true }}
                >
                  <Button
                    type="link"
                    danger
                    size="small"
                    icon={<DeleteOutlined />}
                  />
                </Popconfirm>
              ),
            },
          ]}
        />
      </Card>

      <Modal
        title="Tạo danh mục mới"
        open={isCreateOpen}
        onCancel={() => setIsCreateOpen(false)}
        onOk={() => form.submit()}
        confirmLoading={isSubmitting}
        okText="Tạo"
        cancelText="Hủy"
      >
        <Form form={form} layout="vertical" onFinish={handleCreate}>
          <Form.Item
            label="Tên danh mục"
            name="name"
            rules={[
              { required: true, message: "Vui lòng nhập tên danh mục" },
              { min: 2, message: "Tên danh mục tối thiểu 2 ký tự" },
              { max: 120, message: "Tên danh mục tối đa 120 ký tự" },
            ]}
          >
            <Input placeholder="Ví dụ: Máy giặt mini" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
