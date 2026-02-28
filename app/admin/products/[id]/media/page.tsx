"use client";

import { useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { Spin } from "antd";

export default function ProductMediaRedirectPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const productId = typeof params?.id === "string" ? params.id : "";

  useEffect(() => {
    if (!productId) {
      router.replace("/admin/products");
      return;
    }
    router.replace(`/admin/products/${productId}/edit`);
  }, [productId, router]);

  return (
    <div className="min-h-[50vh] flex flex-col items-center justify-center gap-3">
      <Spin size="large" />
      <span className="text-sm text-gray-500">
        Đang chuyển sang trang chỉnh sửa...
      </span>
    </div>
  );
}
