"use client";

import { useState, useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Layout, Menu, Breadcrumb, Avatar, Dropdown, Grid } from "antd";
import type { MenuProps } from "antd";
import {
  DashboardOutlined,
  ShoppingCartOutlined,
  UserOutlined,
  InboxOutlined,
  AppstoreOutlined,
  LogoutOutlined,
  MenuFoldOutlined,
  MenuUnfoldOutlined,
} from "@ant-design/icons";
import { Toaster } from "sonner";
import { toast } from "sonner";
import { logout } from "@/actions/auth";

const { Header, Sider, Content } = Layout;
const { useBreakpoint } = Grid;

interface AdminLayoutProps {
  children: React.ReactNode;
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
    type: "divider",
  },
  {
    key: "inventory",
    label: "Kho hàng",
    type: "group",
  },
  {
    key: "/admin/inventory",
    icon: <AppstoreOutlined />,
    label: "Sản phẩm",
  },
  {
    key: "/admin/stock-inbound",
    icon: <InboxOutlined />,
    label: "Nhập kho",
  },
];

export function AdminLayout({ children }: AdminLayoutProps) {
  const pathname = usePathname();
  const router = useRouter();
  const screens = useBreakpoint();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false);

  // Auto-collapse sidebar on mobile only
  useEffect(() => {
    if (screens.xs || screens.sm) {
      setCollapsed(true);
    }
  }, [screens]);

  // Close mobile drawer when route changes
  useEffect(() => {
    if (screens.xs || screens.sm) {
      setMobileDrawerOpen(false);
    }
  }, [pathname, screens]);

  const isMobile = screens.xs || screens.sm;

  // Handle menu click
  const handleMenuClick: MenuProps["onClick"] = (e) => {
    router.push(e.key);
  };

  // Handle logout
  const handleLogout = async () => {
    try {
      const result = await logout();
      if (result.success) {
        toast.success("Đã đăng xuất thành công");
        router.push("/login");
      } else {
        toast.error(result.error || "Có lỗi xảy ra khi đăng xuất");
      }
    } catch (error) {
      console.error("Logout error:", error);
      toast.error("Có lỗi xảy ra khi đăng xuất");
    }
  };

  // Dropdown menu for user avatar
  const userMenuItems: MenuProps["items"] = [
    {
      key: "logout",
      icon: <LogoutOutlined />,
      label: "Đăng xuất",
      onClick: handleLogout,
    },
  ];

  // Generate breadcrumb from pathname
  const getBreadcrumbItems = () => {
    const pathSegments = pathname.split("/").filter((seg) => seg);

    const breadcrumbNameMap: Record<string, string> = {
      admin: "Tổng quan",
      orders: "Đơn hàng",
      customers: "Khách hàng",
      inventory: "Sản phẩm",
      "stock-inbound": "Nhập kho",
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
          borderBottom: "1px solid rgba(5, 5, 5, 0.06)",
        }}
      >
        <h1
          style={{
            color: "#fff",
            fontSize: collapsed ? 18 : 20,
            fontWeight: "bold",
            margin: 0,
            transition: "all 0.3s",
          }}
        >
          {collapsed ? "SL" : "SmartLife"}
        </h1>
      </div>

      {/* Menu */}
      <Menu
        theme="dark"
        mode="inline"
        selectedKeys={[pathname]}
        items={menuItems}
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
          collapsible
          collapsed={collapsed}
          onCollapse={setCollapsed}
          breakpoint="lg"
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
          marginLeft: isMobile ? 0 : collapsed ? 80 : 240,
          transition: "margin-left 0.3s",
        }}
      >
        {/* Header */}
        <Header
          style={{
            background: "#fff",
            padding: "0 24px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            borderBottom: "1px solid rgba(5, 5, 5, 0.06)",
            position: "sticky",
            top: 0,
            zIndex: 100,
          }}
        >
          {/* Left: Toggle Button + Breadcrumb */}
          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            {isMobile ? (
              <MenuUnfoldOutlined
                style={{ fontSize: 20, cursor: "pointer" }}
                onClick={() => setMobileDrawerOpen(!mobileDrawerOpen)}
              />
            ) : (
              <div
                style={{ fontSize: 20, cursor: "pointer" }}
                onClick={() => setCollapsed(!collapsed)}
              >
                {collapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
              </div>
            )}

            {!isMobile && <Breadcrumb items={getBreadcrumbItems()} />}
          </div>

          {/* Right: Admin Info */}
          <Dropdown menu={{ items: userMenuItems }} placement="bottomRight">
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                cursor: "pointer",
              }}
            >
              <Avatar
                icon={<UserOutlined />}
                style={{ backgroundColor: "#1890ff" }}
              />
              {!isMobile && <span style={{ fontWeight: 500 }}>Admin</span>}
            </div>
          </Dropdown>
        </Header>

        {/* Breadcrumb on Mobile */}
        {isMobile && (
          <div style={{ padding: "12px 24px", background: "#fff" }}>
            <Breadcrumb items={getBreadcrumbItems()} />
          </div>
        )}

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
