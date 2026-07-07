import { NextRequest, NextResponse } from "next/server";
import { isAdminAuthFailure, requireAdminRole } from "@/lib/adminAuth";
import { AuditLogger } from "@/lib/auditLogger";
import { createServiceRoleSupabaseClient } from "@/lib/supabase-admin";

function toInteger(value: unknown): number | null {
  const normalized = Number(value);
  if (!Number.isInteger(normalized)) return null;
  return normalized;
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  return "Đã xảy ra lỗi";
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

    const body = await request.json();
    const productId = String(body.productId || "").trim();
    const newStockQuantity = toInteger(body.newStockQuantity);
    const expectedStockQuantity = toInteger(body.expectedStockQuantity);
    const reason = String(body.reason || "").trim();

    if (!productId) {
      return NextResponse.json(
        { error: "Product ID là bắt buộc" },
        { status: 400 },
      );
    }

    if (newStockQuantity === null || newStockQuantity < 0) {
      return NextResponse.json(
        { error: "Tồn kho mới phải là số nguyên không âm" },
        { status: 400 },
      );
    }

    if (expectedStockQuantity === null || expectedStockQuantity < 0) {
      return NextResponse.json(
        { error: "Tồn kho hiện tại không hợp lệ, vui lòng tải lại trang" },
        { status: 400 },
      );
    }

    if (reason.length < 3) {
      return NextResponse.json(
        { error: "Vui lòng nhập lý do điều chỉnh tồn kho" },
        { status: 400 },
      );
    }

    const { data: product, error: fetchError } = await sb
      .from("products")
      .select("id, name, stock_quantity")
      .eq("id", productId)
      .single();

    if (fetchError) {
      if ((fetchError as { code?: string }).code === "PGRST116") {
        return NextResponse.json(
          { error: "Không tìm thấy sản phẩm" },
          { status: 404 },
        );
      }
      throw fetchError;
    }

    const oldStockQuantity = Number(product.stock_quantity || 0);
    if (oldStockQuantity !== expectedStockQuantity) {
      return NextResponse.json(
        {
          error:
            "Tồn kho sản phẩm vừa thay đổi ở nơi khác. Vui lòng làm mới rồi thử lại.",
          currentStockQuantity: oldStockQuantity,
        },
        { status: 409 },
      );
    }

    if (oldStockQuantity === newStockQuantity) {
      return NextResponse.json({
        success: true,
        message: "Tồn kho không thay đổi",
        product,
      });
    }

    const { data: updatedProduct, error: updateError } = await sb
      .from("products")
      .update({
        stock_quantity: newStockQuantity,
        updated_at: new Date().toISOString(),
      })
      .eq("id", productId)
      .eq("stock_quantity", oldStockQuantity)
      .select("*")
      .single();

    if (updateError) {
      if ((updateError as { code?: string }).code === "PGRST116") {
        return NextResponse.json(
          {
            error:
              "Tồn kho sản phẩm vừa thay đổi ở nơi khác. Vui lòng làm mới rồi thử lại.",
          },
          { status: 409 },
        );
      }
      throw updateError;
    }

    await AuditLogger.productStockUpdated(
      productId,
      product.name,
      oldStockQuantity,
      newStockQuantity,
      reason,
    );

    return NextResponse.json({
      success: true,
      message: "Đã điều chỉnh tồn kho",
      product: updatedProduct,
      data: {
        old_stock_quantity: oldStockQuantity,
        new_stock_quantity: newStockQuantity,
        delta: newStockQuantity - oldStockQuantity,
        reason,
      },
    });
  } catch (error: unknown) {
    console.error("Error adjusting stock:", error);
    return NextResponse.json(
      { error: getErrorMessage(error) || "Không thể điều chỉnh tồn kho" },
      { status: 500 },
    );
  }
}
