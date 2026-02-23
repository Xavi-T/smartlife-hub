"use client";

import { useParams } from "next/navigation";
import { ProductFormPage } from "@/components/admin/ProductFormPage";

export default function EditProductPage() {
  const params = useParams<{ id: string }>();
  const productId = typeof params?.id === "string" ? params.id : "";

  return <ProductFormPage mode="edit" productId={productId} />;
}
