"use client";

import { useEffect, useMemo, useState } from "react";
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
  Typography,
  message,
} from "antd";
import type { ColumnsType } from "antd/es/table";
import {
  ReloadOutlined,
  PlusOutlined,
  KeyOutlined,
  EditOutlined,
  DeleteOutlined,
} from "@ant-design/icons";

type AppRole = "admin" | "manager" | "employee";

interface UserRow {
  id: string;
  email: string;
  role: AppRole;
  fullName: string;
  createdAt: string;
  lastSignInAt: string | null;
  emailConfirmedAt: string | null;
  isActive: boolean;
}

interface CreateUserForm {
  fullName: string;
  email: string;
  password: string;
  role: AppRole;
}

interface UpdateUserForm {
  fullName: string;
  role: AppRole;
}

const roleColorMap: Record<AppRole, string> = {
  admin: "red",
  manager: "gold",
  employee: "blue",
};

const roleLabelMap: Record<AppRole, string> = {
  admin: "Admin",
  manager: "Manager",
  employee: "Employee",
};

export default function AdminUsersPage() {
  const [form] = Form.useForm<CreateUserForm>();
  const [editForm] = Form.useForm<UpdateUserForm>();
  const [messageApi, contextHolder] = message.useMessage();
  const [rows, setRows] = useState<UserRow[]>([]);
  const [currentUserId, setCurrentUserId] = useState<string>("");
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<UserRow | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [deletingUserId, setDeletingUserId] = useState<string | null>(null);
  const [resettingUserId, setResettingUserId] = useState<string | null>(null);
  const [fetchError, setFetchError] = useState<string>("");

  const fetchUsers = async (refresh = false) => {
    try {
      if (refresh) {
        setIsRefreshing(true);
      } else {
        setIsLoading(true);
      }
      setFetchError("");

      const res = await fetch("/api/admin/users");
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Không thể tải danh sách account");
      }

      setRows(Array.isArray(data.users) ? data.users : []);
      setCurrentUserId(String(data.currentUserId || ""));
    } catch (error) {
      const errorMessage =
        error instanceof Error
          ? error.message
          : "Không thể tải danh sách account";
      setFetchError(errorMessage);
      messageApi.error(errorMessage);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const handleCreateUser = async (values: CreateUserForm) => {
    try {
      setIsCreating(true);
      const res = await fetch("/api/admin/users", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(values),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Không thể tạo tài khoản");
      }

      messageApi.success("Đã tạo tài khoản mới");
      form.resetFields();
      setIsCreateModalOpen(false);
      await fetchUsers(true);
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Không thể tạo tài khoản";
      messageApi.error(errorMessage);
    } finally {
      setIsCreating(false);
    }
  };

  const handleResetPassword = async (user: UserRow) => {
    try {
      setResettingUserId(user.id);
      const res = await fetch("/api/admin/users/reset-password", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ userId: user.id }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Không thể reset mật khẩu");
      }

      Modal.info({
        title: "Mật khẩu tạm thời",
        content: (
          <Space orientation="vertical" size={8}>
            <Typography.Text>
              Tài khoản: <Typography.Text strong>{user.email}</Typography.Text>
            </Typography.Text>
            <Typography.Text copyable strong>
              {data.temporaryPassword}
            </Typography.Text>
            <Typography.Text type="secondary">
              Hãy gửi mật khẩu này cho người dùng và yêu cầu đổi lại sau khi
              đăng nhập.
            </Typography.Text>
          </Space>
        ),
      });
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Không thể reset mật khẩu";
      messageApi.error(errorMessage);
    } finally {
      setResettingUserId(null);
    }
  };

  const openEditModal = (user: UserRow) => {
    setEditingUser(user);
    editForm.setFieldsValue({
      fullName: user.fullName,
      role: user.role,
    });
    setIsEditModalOpen(true);
  };

  const handleUpdateUser = async (values: UpdateUserForm) => {
    if (!editingUser) return;

    try {
      setIsUpdating(true);
      const res = await fetch("/api/admin/users", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          userId: editingUser.id,
          fullName: values.fullName,
          role: values.role,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Không thể cập nhật tài khoản");
      }

      messageApi.success("Đã cập nhật tài khoản");
      setIsEditModalOpen(false);
      setEditingUser(null);
      await fetchUsers(true);
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Không thể cập nhật tài khoản";
      messageApi.error(errorMessage);
    } finally {
      setIsUpdating(false);
    }
  };

  const handleDeleteUser = async (user: UserRow) => {
    try {
      setDeletingUserId(user.id);
      const params = new URLSearchParams({ userId: user.id });
      const res = await fetch(`/api/admin/users?${params.toString()}`, {
        method: "DELETE",
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Không thể xóa tài khoản");
      }

      messageApi.success("Đã xóa tài khoản");
      await fetchUsers(true);
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Không thể xóa tài khoản";
      messageApi.error(errorMessage);
    } finally {
      setDeletingUserId(null);
    }
  };

  const columns: ColumnsType<UserRow> = useMemo(
    () => [
      {
        title: "Họ tên",
        dataIndex: "fullName",
        key: "fullName",
      },
      {
        title: "Email",
        dataIndex: "email",
        key: "email",
      },
      {
        title: "Role",
        dataIndex: "role",
        key: "role",
        width: 120,
        render: (role: AppRole) => (
          <Tag color={roleColorMap[role]}>{roleLabelMap[role]}</Tag>
        ),
      },
      {
        title: "Trạng thái",
        dataIndex: "isActive",
        key: "isActive",
        width: 130,
        render: (isActive: boolean, row) => (
          <Tag color={isActive && row.emailConfirmedAt ? "green" : "orange"}>
            {isActive && row.emailConfirmedAt ? "Hoạt động" : "Chưa xác nhận"}
          </Tag>
        ),
      },
      {
        title: "Đăng nhập gần nhất",
        dataIndex: "lastSignInAt",
        key: "lastSignInAt",
        width: 180,
        render: (value: string | null) =>
          value ? new Date(value).toLocaleString("vi-VN") : "-",
      },
      {
        title: "Thao tác",
        key: "actions",
        width: 260,
        render: (_value, row) => (
          <Space size={8}>
            <Button
              icon={<EditOutlined />}
              size="small"
              onClick={() => openEditModal(row)}
            >
              Sửa
            </Button>

            <Popconfirm
              title="Reset mật khẩu tài khoản này?"
              okText="Reset"
              cancelText="Hủy"
              onConfirm={() => handleResetPassword(row)}
            >
              <Button
                icon={<KeyOutlined />}
                loading={resettingUserId === row.id}
                size="small"
              >
                Reset pass
              </Button>
            </Popconfirm>

            <Popconfirm
              title="Xóa tài khoản này?"
              description="Hành động này không thể hoàn tác"
              okText="Xóa"
              okButtonProps={{ danger: true }}
              cancelText="Hủy"
              onConfirm={() => handleDeleteUser(row)}
              disabled={row.id === currentUserId}
            >
              <Button
                icon={<DeleteOutlined />}
                danger
                size="small"
                loading={deletingUserId === row.id}
                disabled={row.id === currentUserId}
              >
                Xóa
              </Button>
            </Popconfirm>
          </Space>
        ),
      },
    ],
    [currentUserId, deletingUserId, resettingUserId],
  );

  return (
    <div style={{ background: "#f5f5f5", minHeight: "100vh", padding: 16 }}>
      {contextHolder}
      <Card
        title="Quản lý tài khoản người dùng"
        extra={
          <Space>
            <Button
              icon={<ReloadOutlined spin={isRefreshing} />}
              onClick={() => fetchUsers(true)}
              loading={isRefreshing}
            >
              Làm mới
            </Button>
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={() => setIsCreateModalOpen(true)}
            >
              Tạo tài khoản
            </Button>
          </Space>
        }
      >
        {fetchError && (
          <Alert
            type="error"
            showIcon
            style={{ marginBottom: 16 }}
            title={fetchError}
          />
        )}

        <Table
          rowKey="id"
          loading={isLoading}
          dataSource={rows}
          columns={columns}
          pagination={{ pageSize: 10 }}
          scroll={{ x: 900 }}
        />
      </Card>

      <Modal
        title="Tạo tài khoản mới"
        open={isCreateModalOpen}
        forceRender
        onCancel={() => setIsCreateModalOpen(false)}
        okText="Tạo tài khoản"
        cancelText="Hủy"
        okButtonProps={{
          loading: isCreating,
          onClick: () => form.submit(),
        }}
        destroyOnHidden
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={handleCreateUser}
          initialValues={{ role: "employee" }}
        >
          <Form.Item
            name="fullName"
            label="Họ tên"
            rules={[{ required: true, message: "Vui lòng nhập họ tên" }]}
          >
            <Input placeholder="Nguyễn Văn A" />
          </Form.Item>

          <Form.Item
            name="email"
            label="Email"
            rules={[
              { required: true, message: "Vui lòng nhập email" },
              { type: "email", message: "Email không hợp lệ" },
            ]}
          >
            <Input placeholder="user@smartlifehub.vn" />
          </Form.Item>

          <Form.Item
            name="password"
            label="Mật khẩu"
            rules={[
              { required: true, message: "Vui lòng nhập mật khẩu" },
              { min: 8, message: "Mật khẩu tối thiểu 8 ký tự" },
            ]}
          >
            <Input.Password placeholder="Nhập mật khẩu" />
          </Form.Item>

          <Form.Item
            name="role"
            label="Role"
            rules={[{ required: true, message: "Vui lòng chọn role" }]}
          >
            <Select
              options={[
                { label: "Admin", value: "admin" },
                { label: "Manager", value: "manager" },
                { label: "Employee", value: "employee" },
              ]}
            />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title="Cập nhật tài khoản"
        open={isEditModalOpen}
        forceRender
        onCancel={() => {
          setIsEditModalOpen(false);
          setEditingUser(null);
        }}
        okText="Lưu thay đổi"
        cancelText="Hủy"
        okButtonProps={{
          loading: isUpdating,
          onClick: () => editForm.submit(),
        }}
        destroyOnHidden
      >
        <Form form={editForm} layout="vertical" onFinish={handleUpdateUser}>
          <Form.Item label="Email">
            <Input value={editingUser?.email} disabled />
          </Form.Item>

          <Form.Item
            name="fullName"
            label="Họ tên"
            rules={[{ required: true, message: "Vui lòng nhập họ tên" }]}
          >
            <Input placeholder="Nguyễn Văn A" />
          </Form.Item>

          <Form.Item
            name="role"
            label="Role"
            rules={[{ required: true, message: "Vui lòng chọn role" }]}
          >
            <Select
              options={[
                { label: "Admin", value: "admin" },
                { label: "Manager", value: "manager" },
                { label: "Employee", value: "employee" },
              ]}
            />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
