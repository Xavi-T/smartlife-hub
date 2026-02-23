"use client";

import { useEffect, useMemo, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import {
  Layout,
  Menu,
  Breadcrumb,
  Avatar,
  Dropdown,
  Grid,
  Badge,
  Space,
  Select,
  Typography,
} from "antd";
import type { MenuProps } from "antd";
import {
  DashboardOutlined,
  ShoppingCartOutlined,
  ThunderboltOutlined,
  UserOutlined,
  TeamOutlined,
  CrownOutlined,
  InboxOutlined,
  AppstoreOutlined,
  TagsOutlined,
  LogoutOutlined,
  MenuUnfoldOutlined,
  HistoryOutlined,
  AuditOutlined,
  DownOutlined,
} from "@ant-design/icons";
import { Toaster } from "sonner";
import { toast } from "sonner";
import { logout } from "@/actions/auth";
import { createBrowserSupabaseClient } from "@/lib/supabase-browser";
import { canAccessAdminPath, getRoleFromUser, type AppRole } from "@/lib/rbac";

const { Header, Sider, Content } = Layout;
const { useBreakpoint } = Grid;

const roleLabelMap: Record<AppRole, string> = {
  admin: "Admin",
  manager: "Manager",
  employee: "Employee",
};

interface AdminLayoutProps {
  children: React.ReactNode;
}

interface HeaderPriorityCustomer {
  id: string;
  customer_name: string;
  customer_phone: string;
  customer_segment: string;
  discount_percent: number;
}

// Menu items với icon và label
const menuItems: MenuProps["items"] = [
  {
    key: "/admin",
    icon: <DashboardOutlined />,
    label: "Tổng quan",
  },
  {
    type: "divider",
  },
  {
    key: "sales",
    label: "Bán hàng",
    type: "group",
  },
  {
    key: "/admin/quick-sales",
    icon: <ThunderboltOutlined />,
    label: "Bán hàng nhanh",
  },
  {
    key: "/admin/orders",
    icon: <ShoppingCartOutlined />,
    label: "Đơn hàng",
  },
  {
    key: "/admin/customers",
    icon: <UserOutlined />,
    label: "Khách hàng",
  },
  {
    key: "/admin/priority-customers",
    icon: <CrownOutlined />,
    label: "Khách hàng ưu tiên",
  },
  {
    type: "divider",
  },
  {
    key: "inventory",
    label: "Kho hàng",
    type: "group",
  },
  {
    key: "/admin/products",
    icon: <AppstoreOutlined />,
    label: "Sản phẩm",
  },
  {
    key: "/admin/categories",
    icon: <TagsOutlined />,
    label: "Danh mục",
  },
  {
    key: "/admin/inventory",
    icon: <InboxOutlined />,
    label: "Kho hàng",
  },
  {
    key: "/admin/stock-inbound",
    icon: <InboxOutlined />,
    label: "Nhập kho",
  },
  {
    key: "/admin/stock-history",
    icon: <HistoryOutlined />,
    label: "Lịch sử kho",
  },
  {
    type: "divider",
  },
  {
    key: "system",
    label: "Hệ thống",
    type: "group",
  },
  {
    key: "/admin/audit-logs",
    icon: <AuditOutlined />,
    label: "Nhật ký hoạt động",
  },
  {
    key: "/admin/users",
    icon: <TeamOutlined />,
    label: "Quản lý users",
  },
];

export function AdminLayout({ children }: AdminLayoutProps) {
  const pathname = usePathname();
  const router = useRouter();
  const screens = useBreakpoint();
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false);
  const [prioritySearch, setPrioritySearch] = useState("");
  const [priorityCustomers, setPriorityCustomers] = useState<
    HeaderPriorityCustomer[]
  >([]);
  const [isPrioritySearching, setIsPrioritySearching] = useState(false);
  const [currentUserRole, setCurrentUserRole] = useState<AppRole>("admin");
  const [currentUserEmail, setCurrentUserEmail] = useState(
    "admin@smartlife.com",
  );
  const [currentUserName, setCurrentUserName] = useState("Administrator");

  const isMobile = screens.xs || screens.sm;

  useEffect(() => {
    const supabase = createBrowserSupabaseClient();
    const loadCurrentUser = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) return;

      const role = getRoleFromUser(user);
      setCurrentUserRole(role);
      setCurrentUserEmail(user.email || "");
      setCurrentUserName(
        String(user.user_metadata?.fullName || "Administrator"),
      );
    };

    loadCurrentUser();
  }, []);

  useEffect(() => {
    const timeoutId = setTimeout(async () => {
      try {
        setIsPrioritySearching(true);
        const params = new URLSearchParams();
        params.set("active", "active");
        if (prioritySearch.trim()) {
          params.set("search", prioritySearch.trim());
        }

        const response = await fetch(
          `/api/admin/priority-customers?${params.toString()}`,
        );

        if (!response.ok) {
          setPriorityCustomers([]);
          return;
        }

        const result = await response.json();
        const rows = Array.isArray(result.customers) ? result.customers : [];
        setPriorityCustomers(rows.slice(0, 8));
      } catch (error) {
        console.error("Error searching priority customers:", error);
        setPriorityCustomers([]);
      } finally {
        setIsPrioritySearching(false);
      }
    }, 300);

    return () => clearTimeout(timeoutId);
  }, [prioritySearch]);

  const filteredMenuItems = useMemo(() => {
    if (currentUserRole !== "employee") {
      return menuItems;
    }

    return [
      {
        key: "sales",
        label: "Bán hàng",
        type: "group",
      },
      {
        key: "/admin/quick-sales",
        icon: <ThunderboltOutlined />,
        label: "Bán hàng nhanh",
      },
      {
        key: "/admin/orders",
        icon: <ShoppingCartOutlined />,
        label: "Đơn hàng",
      },
    ] as MenuProps["items"];
  }, [currentUserRole]);

  // Handle menu click
  const handleMenuClick: MenuProps["onClick"] = (e) => {
    router.push(e.key);
  };

  // Handle logout
  const handleLogout = async () => {
    try {
      await logout();
      toast.success("Đã đăng xuất thành công");
      router.push("/login");
    } catch (error) {
      console.error("Logout error:", error);
      toast.error("Có lỗi xảy ra khi đăng xuất");
    }
  };

  // Dropdown menu for user avatar
  const userMenuItems: MenuProps["items"] = [
    {
      key: "user-info",
      disabled: true,
      label: (
        <div style={{ minWidth: 220, lineHeight: 1.5 }}>
          <div style={{ fontWeight: 600, color: "#262626" }}>
            {currentUserName}
          </div>
          <div style={{ fontSize: 12, color: "#8c8c8c" }}>
            {currentUserEmail}
          </div>
          <div style={{ fontSize: 12, color: "#595959" }}>
            Vai trò: {roleLabelMap[currentUserRole]}
          </div>
        </div>
      ),
    },
    {
      type: "divider",
    },
    {
      key: "logout",
      icon: <LogoutOutlined />,
      label: "Đăng xuất",
      onClick: handleLogout,
      danger: true,
    },
  ];

  // Generate breadcrumb from pathname
  const getBreadcrumbItems = () => {
    const pathSegments = pathname.split("/").filter((seg) => seg);

    const breadcrumbNameMap: Record<string, string> = {
      admin: "Tổng quan",
      products: "Sản phẩm",
      categories: "Danh mục",
      orders: "Đơn hàng",
      customers: "Khách hàng",
      "priority-customers": "Khách hàng ưu tiên",
      "quick-sales": "Bán hàng nhanh",
      inventory: "Kho hàng",
      "stock-inbound": "Nhập kho",
      "stock-history": "Lịch sử kho",
      "audit-logs": "Nhật ký hoạt động",
      users: "Quản lý users",
    };

    return pathSegments.map((segment, index) => {
      const url = `/${pathSegments.slice(0, index + 1).join("/")}`;
      return {
        title: breadcrumbNameMap[segment] || segment,
        href: url === pathname ? undefined : url,
      };
    });
  };

  const siderContent = (
    <>
      {/* Logo */}
      <div
        style={{
          height: 64,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: 12,
          padding: "0 16px",
          borderBottom: "1px solid rgba(255, 255, 255, 0.1)",
        }}
      >
        <img
          src="/logo.png"
          alt="SmartLife Logo"
          style={{
            height: 40,
            width: 40,
            objectFit: "contain",
            borderRadius: "10%",
          }}
        />
        <h1
          style={{
            color: "#fff",
            fontSize: 20,
            fontWeight: "bold",
            margin: 0,
          }}
        >
          SmartLife
        </h1>
      </div>

      {/* Menu */}
      <Menu
        theme="dark"
        mode="inline"
        selectedKeys={[pathname]}
        items={filteredMenuItems}
        onClick={handleMenuClick}
        style={{ borderRight: 0 }}
      />
    </>
  );

  return (
    <Layout style={{ minHeight: "100vh" }}>
      {/* Sidebar - Desktop */}
      {!isMobile && (
        <Sider
          theme="dark"
          width={240}
          style={{
            overflow: "auto",
            height: "100vh",
            position: "fixed",
            left: 0,
            top: 0,
            bottom: 0,
          }}
        >
          {siderContent}
        </Sider>
      )}

      {/* Sidebar - Mobile Drawer */}
      {isMobile && (
        <Sider
          theme="dark"
          width={240}
          style={{
            overflow: "auto",
            height: "100vh",
            position: "fixed",
            left: mobileDrawerOpen ? 0 : -240,
            top: 0,
            bottom: 0,
            zIndex: 1000,
            transition: "left 0.3s",
          }}
        >
          {siderContent}
        </Sider>
      )}

      {/* Mobile Overlay */}
      {isMobile && mobileDrawerOpen && (
        <div
          onClick={() => setMobileDrawerOpen(false)}
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: "rgba(0, 0, 0, 0.45)",
            zIndex: 999,
          }}
        />
      )}

      {/* Main Layout */}
      <Layout
        style={{
          marginLeft: isMobile ? 0 : 240,
        }}
      >
        {/* Header */}
        <Header
          style={{
            background: "#fff",
            padding: "0 32px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            borderBottom: "1px solid #f0f0f0",
            position: "sticky",
            top: 0,
            zIndex: 100,
            boxShadow: "0 1px 4px rgba(0,21,41,.08)",
          }}
        >
          {/* Left: Breadcrumb */}
          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            {isMobile && (
              <MenuUnfoldOutlined
                style={{ fontSize: 20, cursor: "pointer", color: "#1890ff" }}
                onClick={() => setMobileDrawerOpen(!mobileDrawerOpen)}
              />
            )}

            <Breadcrumb items={getBreadcrumbItems()} />

            {!isMobile && currentUserRole !== "employee" && (
              <Space size={8}>
                <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                  Danh sách KH ưu tiên
                </Typography.Text>
                <Select
                  showSearch
                  allowClear
                  value={undefined}
                  placeholder="Tìm khách hàng ưu tiên..."
                  style={{ width: 320 }}
                  filterOption={false}
                  onSearch={setPrioritySearch}
                  notFoundContent={
                    isPrioritySearching ? "Đang tìm..." : "Không có kết quả"
                  }
                  options={priorityCustomers.map((customer) => ({
                    value: customer.id,
                    label: `${customer.customer_name} • ${customer.customer_phone}`,
                  }))}
                  onSelect={(value) => {
                    const selected = priorityCustomers.find(
                      (item) => item.id === value,
                    );
                    if (!selected) return;
                    router.push(
                      `/admin/priority-customers?search=${encodeURIComponent(selected.customer_phone)}`,
                    );
                  }}
                />
              </Space>
            )}
          </div>

          {/* Right: Admin Info */}
          <Dropdown
            menu={{ items: userMenuItems }}
            placement="bottomRight"
            trigger={["click"]}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 12,
                cursor: "pointer",
                padding: "6px 16px",
                borderRadius: 8,
                transition: "all 0.2s",
                border: "1px solid transparent",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = "#f5f5f5";
                e.currentTarget.style.borderColor = "#d9d9d9";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = "transparent";
                e.currentTarget.style.borderColor = "transparent";
              }}
            >
              <Badge dot status="success" offset={[-4, 36]}>
                <div
                  title={`${currentUserName} (${roleLabelMap[currentUserRole]})`}
                >
                  <Avatar
                    icon={<UserOutlined />}
                    size={40}
                    style={{
                      backgroundColor: "#1890ff",
                      border: "2px solid #e6f7ff",
                    }}
                  />
                </div>
              </Badge>
              {!isMobile && (
                <Space orientation="vertical" size={0}>
                  <div
                    style={{
                      fontWeight: 600,
                      fontSize: 14,
                      color: "#262626",
                      lineHeight: "20px",
                    }}
                  >
                    {currentUserName}
                  </div>
                  <div
                    style={{
                      fontSize: 12,
                      color: "#8c8c8c",
                      lineHeight: "18px",
                    }}
                  >
                    {currentUserEmail}
                  </div>
                  <div
                    style={{
                      fontSize: 12,
                      color: "#8c8c8c",
                      lineHeight: "18px",
                    }}
                  >
                    {roleLabelMap[currentUserRole]}
                  </div>
                </Space>
              )}
              <DownOutlined style={{ fontSize: 10, color: "#8c8c8c" }} />
            </div>
          </Dropdown>
        </Header>

        {/* Content */}
        <Content
          style={{
            margin: "24px 16px",
            padding: 24,
            minHeight: 280,
            background: "#f5f5f5",
          }}
        >
          {children}
        </Content>
      </Layout>

      {/* Toast Notifications */}
      <Toaster
        position="top-right"
        richColors
        expand={false}
        closeButton
        toastOptions={{
          duration: 3000,
          className: "text-sm",
        }}
      />
    </Layout>
  );
}
