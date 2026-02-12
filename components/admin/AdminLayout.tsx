"use client";
import { useState } from "react";
import { AdminSidebar } from "./AdminSidebar";
import { AdminHeader } from "./AdminHeader";
import { QuickOrderModal } from "./QuickOrderModal";
import { StockInboundModal } from "./StockInboundModal";
import { Toaster } from "sonner";

interface AdminLayoutProps {
  children: React.ReactNode;
}

export function AdminLayout({ children }: AdminLayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [quickOrderOpen, setQuickOrderOpen] = useState(false);
  const [stockInboundOpen, setStockInboundOpen] = useState(false);

  return (
    <div className="min-h-screen bg-gray-50 flex">
      {/* Sidebar */}
      <AdminSidebar
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
      />

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Header */}
        <AdminHeader
          onMenuClick={() => setSidebarOpen(true)}
          onQuickOrder={() => setQuickOrderOpen(true)}
          onQuickStockInbound={() => setStockInboundOpen(true)}
        />

        {/* Page Content */}
        <main className="flex-1 overflow-auto p-4 lg:p-6">{children}</main>
      </div>

      {/* Quick Action Modals */}
      <QuickOrderModal
        isOpen={quickOrderOpen}
        onClose={() => setQuickOrderOpen(false)}
      />

      <StockInboundModal
        isOpen={stockInboundOpen}
        onClose={() => setStockInboundOpen(false)}
      />

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
    </div>
  );
}
