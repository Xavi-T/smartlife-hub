"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { APP_CONFIG } from "@/lib/appConfig";

const TITLE_MAP: Record<string, string> = {
  "/": `${APP_CONFIG.shopName} – ${APP_CONFIG.shopTagline}`,
  "/about": "Về SmartLife Hub",
  "/nutrition": "Kiến thức dinh dưỡng",
  "/nutrition/calculator": "Tính nhu cầu dinh dưỡng",
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
    }
  }, [pathname]);

  return null;
}
