"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { APP_CONFIG } from "@/lib/appConfig";

const TITLE_MAP: Record<string, string> = {
  "/": `${APP_CONFIG.shopName} – Đồ gia dụng thông minh`,
  "/checkout": "Thanh toán đơn hàng",
  "/orders/track": "Tra cứu đơn hàng",
  "/priority-customers": "Danh sách khách hàng ưu tiên",
  "/login": "Đăng nhập quản trị",
};

export function TitleSync() {
  const pathname = usePathname();

  useEffect(() => {
    if (!pathname) return;

    const baseName = APP_CONFIG.shopName;
    const normalizedPath = pathname.split("?")[0];
    const customTitle = TITLE_MAP[normalizedPath];

    if (normalizedPath === "/") {
      document.title = TITLE_MAP["/"];
      return;
    }

    if (customTitle) {
      document.title = `${customTitle} | ${baseName}`;
      return;
    }

    document.title = `${baseName} – Đồ gia dụng thông minh`;
  }, [pathname]);

  return null;
}

