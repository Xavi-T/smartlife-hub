"use client";

import { usePathname } from "next/navigation";
import { SiteFooter } from "@/components/home/SiteFooter";
import { FloatingChatButtons } from "@/components/home/FloatingChatButtons";

export function PublicSiteWidgets() {
  const pathname = usePathname();
  const isHidden =
    pathname.startsWith("/admin") || pathname.startsWith("/login");

  if (isHidden) return null;

  return (
    <>
      <SiteFooter />
      <FloatingChatButtons />
    </>
  );
}
