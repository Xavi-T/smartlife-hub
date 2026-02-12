"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Package,
  ShoppingCart,
  Users,
  TrendingUp,
  History,
  FileText,
  X,
  ChevronDown,
  LogOut,
} from "lucide-react";
import { useState, useTransition } from "react";
import { logout } from "@/actions/auth";
import { toast } from "sonner";
import { ConfirmDialog } from "./ConfirmDialog";

interface NavItem {
  label: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  badge?: number;
}

interface NavGroup {
  title: string;
  items: NavItem[];
}

interface AdminSidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

export function AdminSidebar({ isOpen, onClose }: AdminSidebarProps) {
  const pathname = usePathname();
  const [isPending, startTransition] = useTransition();
  const [showLogoutDialog, setShowLogoutDialog] = useState(false);
  const [expandedGroups, setExpandedGroups] = useState<string[]>([
    "Tổng quan",
    "Bán hàng",
    "Kho bãi",
  ]);

  const navGroups: NavGroup[] = [
    {
      title: "Tổng quan",
      items: [
        {
          label: "Dashboard",
          href: "/admin",
          icon: LayoutDashboard,
        },
      ],
    },
    {
      title: "Bán hàng",
      items: [
        {
          label: "Đơn hàng",
          href: "/admin/orders",
          icon: ShoppingCart,
        },
        {
          label: "Khách hàng",
          href: "/admin/customers",
          icon: Users,
        },
      ],
    },
    {
      title: "Kho bãi",
      items: [
        {
          label: "Quản lý kho",
          href: "/admin/inventory",
          icon: Package,
        },
        {
          label: "Lịch sử nhập",
          href: "/admin/stock-history",
          icon: History,
        },
      ],
    },
    {
      title: "Báo cáo",
      items: [
        {
          label: "Audit Logs",
          href: "/admin/audit-logs",
          icon: FileText,
        },
      ],
    },
  ];

  const toggleGroup = (title: string) => {
    setExpandedGroups((prev) =>
      prev.includes(title) ? prev.filter((g) => g !== title) : [...prev, title],
    );
  };

  const isActive = (href: string) => {
    if (href === "/admin") {
      return pathname === href;
    }
    return pathname.startsWith(href);
  };

  const handleLogout = () => {
    setShowLogoutDialog(true);
  };

  const confirmLogout = () => {
    startTransition(async () => {
      try {
        await logout();
        toast.success("Đã đăng xuất thành công");
      } catch (error) {
        toast.error("Có lỗi xảy ra khi đăng xuất");
      }
    });
  };

  return (
    <>
      {/* Overlay for mobile */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={onClose}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`
          fixed top-0 left-0 h-full bg-white border-r border-gray-200 z-50
          transition-transform duration-300 ease-in-out
          ${isOpen ? "translate-x-0" : "-translate-x-full"}
          lg:translate-x-0 lg:static lg:z-0
          w-64 flex flex-col
        `}
      >
        {/* Header */}
        <div className="h-16 flex items-center justify-between px-6 border-b border-gray-200">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg flex items-center justify-center">
              <TrendingUp className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-gray-900">SmartLife</h2>
              <p className="text-xs text-gray-500">Admin Panel</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="lg:hidden p-1 hover:bg-gray-100 rounded"
          >
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto py-6 px-3">
          {navGroups.map((group) => {
            const isExpanded = expandedGroups.includes(group.title);
            return (
              <div key={group.title} className="mb-6">
                <button
                  onClick={() => toggleGroup(group.title)}
                  className="w-full flex items-center justify-between px-3 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wider hover:text-gray-700 transition-colors"
                >
                  {group.title}
                  <ChevronDown
                    className={`w-4 h-4 transition-transform ${
                      isExpanded ? "rotate-180" : ""
                    }`}
                  />
                </button>
                {isExpanded && (
                  <div className="mt-2 space-y-1">
                    {group.items.map((item) => {
                      const Icon = item.icon;
                      const active = isActive(item.href);
                      return (
                        <Link
                          key={item.href}
                          href={item.href}
                          onClick={() => {
                            // Close sidebar on mobile after navigation
                            if (window.innerWidth < 1024) {
                              onClose();
                            }
                          }}
                          className={`
                            flex items-center gap-3 px-3 py-2.5 rounded-lg
                            transition-all duration-200
                            ${
                              active
                                ? "bg-blue-50 text-blue-700 font-medium shadow-sm"
                                : "text-gray-700 hover:bg-gray-50 hover:text-gray-900"
                            }
                          `}
                        >
                          <Icon
                            className={`w-5 h-5 ${
                              active ? "text-blue-700" : "text-gray-400"
                            }`}
                          />
                          <span className="flex-1 text-sm">{item.label}</span>
                          {item.badge !== undefined && (
                            <span
                              className={`
                              px-2 py-0.5 text-xs font-semibold rounded-full
                              ${
                                active
                                  ? "bg-blue-100 text-blue-700"
                                  : "bg-gray-100 text-gray-600"
                              }
                            `}
                            >
                              {item.badge}
                            </span>
                          )}
                        </Link>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </nav>

        {/* Footer */}
        <div className="p-4 border-t border-gray-200 space-y-3">
          {/* Logout Button */}
          <button
            onClick={handleLogout}
            disabled={isPending}
            className="w-full flex items-center gap-3 px-3 py-2.5 text-red-600 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <LogOut className="w-5 h-5" />
            <span className="text-sm font-medium">
              {isPending ? "Đang đăng xuất..." : "Đăng xuất"}
            </span>
          </button>

          {/* Version Info */}
          <div className="px-3 py-2 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg">
            <p className="text-xs font-medium text-gray-700 mb-1">
              Phiên bản 1.0
            </p>
            <p className="text-xs text-gray-500">© 2026 SmartLife Hub</p>
          </div>
        </div>
      </aside>

      {/* Logout Confirmation Dialog */}
      <ConfirmDialog
        isOpen={showLogoutDialog}
        onClose={() => setShowLogoutDialog(false)}
        onConfirm={confirmLogout}
        title="Xác nhận đăng xuất"
        message="Bạn có chắc chắn muốn đăng xuất khỏi hệ thống?"
        confirmText="Đăng xuất"
        cancelText="Hủy"
        isDangerous={true}
        isLoading={isPending}
      />
    </>
  );
}
