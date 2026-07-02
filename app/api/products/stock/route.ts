import { NextRequest, NextResponse } from "next/server";
import { isAdminAuthFailure, requireAdminRole } from "@/lib/adminAuth";
import { createServiceRoleSupabaseClient } from "@/lib/supabase-admin";

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

    const { productId, quantity, reason } = await request.json();
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

    const normalizedReason =
      String(reason || "").trim() || "Điều chỉnh tồn kho thủ công";
    const { error: updateError } = await sb.rpc(
      "adjust_product_stock_with_history",
      {
        p_product_id: productId,
        p_quantity_delta: normalizedQuantity,
        p_reason: normalizedReason,
        p_changed_by: auth.user.email || auth.user.id,
      },
    );
    if (updateError) {
      if (
        updateError.code === "PGRST202" ||
        updateError.message?.includes("adjust_product_stock_with_history")
      ) {
        return NextResponse.json(
          {
            error:
              "Chưa cài đặt lịch sử điều chỉnh kho. Hãy chạy database/tax_readiness_schema.sql trên Supabase.",
          },
          { status: 503 },
        );
      }
      throw updateError;
    }

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
