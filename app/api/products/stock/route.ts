import { NextRequest, NextResponse } from "next/server";
import { isAdminAuthFailure, requireAdminRole } from "@/lib/adminAuth";
import { createServiceRoleSupabaseClient } from "@/lib/supabase-admin";

interface StockRpcClient {
  rpc(
    functionName: "increment_product_stock" | "decrement_product_stock",
    args: {
      product_uuid: string;
      quantity_to_add?: number;
      quantity_to_subtract?: number;
    },
  ): PromiseLike<{
    error: { message?: string } | null;
  }>;
}

export async function PATCH(request: NextRequest) {
  try {
    const auth = await requireAdminRole();
    if (isAdminAuthFailure(auth)) return auth.response;

    const sb = createServiceRoleSupabaseClient();
    if (!sb) {
      return NextResponse.json(
        { error: "Thiếu cấu hình SUPABASE_SERVICE_ROLE_KEY" },
        { status: 500 },
      );
    }

    const { productId, quantity } = await request.json();
    const normalizedQuantity = Number(quantity);

    if (
      !productId ||
      !Number.isInteger(normalizedQuantity) ||
      normalizedQuantity === 0
    ) {
      return NextResponse.json(
        { error: "Product ID và số lượng nguyên khác 0 là bắt buộc" },
        { status: 400 },
      );
    }

    const stockRpcClient = sb as unknown as StockRpcClient;
    const { error: updateError } =
      normalizedQuantity > 0
        ? await stockRpcClient.rpc("increment_product_stock", {
            product_uuid: productId,
            quantity_to_add: normalizedQuantity,
          })
        : await stockRpcClient.rpc("decrement_product_stock", {
            product_uuid: productId,
            quantity_to_subtract: Math.abs(normalizedQuantity),
          });
    if (updateError) throw updateError;

    const { data, error: fetchError } = await sb
      .from("products")
      .select("*")
      .eq("id", productId)
      .single();
    if (fetchError) throw fetchError;

    return NextResponse.json(data);
  } catch (error: unknown) {
    console.error("Error updating stock:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Không thể cập nhật tồn kho",
      },
      { status: 500 },
    );
  }
}
