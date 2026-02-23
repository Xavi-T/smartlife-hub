import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { AuditLogger } from "@/lib/auditLogger";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";

type OrderStatus = "pending" | "processing" | "delivered" | "cancelled";

function createAdminOrdersClient() {
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;

  if (!serviceRoleKey || !supabaseUrl) {
    return supabase as any;
  }

  return createClient<Database>(supabaseUrl, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  }) as any;
}

export async function PATCH(request: NextRequest) {
  try {
    const authClient = await createServerSupabaseClient();
    const {
      data: { user },
    } = await authClient.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { orderId, newStatus, currentStatus } = await request.json();
    const sb = createAdminOrdersClient();

    if (!orderId || !newStatus) {
      return NextResponse.json(
        { error: "Order ID và trạng thái mới là bắt buộc" },
        { status: 400 },
      );
    }

    // Validate status
    const validStatuses: OrderStatus[] = [
      "pending",
      "processing",
      "delivered",
      "cancelled",
    ];
    const normalizedNewStatus = newStatus as OrderStatus;
    const normalizedCurrentStatus = currentStatus as OrderStatus;

    if (!validStatuses.includes(normalizedNewStatus)) {
      return NextResponse.json(
        { error: "Trạng thái không hợp lệ" },
        { status: 400 },
      );
    }

    if (!validStatuses.includes(normalizedCurrentStatus)) {
      return NextResponse.json(
        { error: "Trạng thái hiện tại không hợp lệ" },
        { status: 400 },
      );
    }

    const allowedTransitions: Record<OrderStatus, OrderStatus[]> = {
      pending: ["processing", "cancelled"],
      processing: ["pending", "delivered", "cancelled"],
      delivered: ["cancelled"],
      cancelled: [],
    };

    if (
      !allowedTransitions[normalizedCurrentStatus].includes(normalizedNewStatus)
    ) {
      return NextResponse.json(
        {
          error: `Không thể chuyển từ ${normalizedCurrentStatus} sang ${normalizedNewStatus}`,
        },
        { status: 400 },
      );
    }

    const isStockDeductedStatus = (status: OrderStatus) =>
      status === "processing" || status === "delivered";

    const shouldDeductStock =
      !isStockDeductedStatus(normalizedCurrentStatus) &&
      isStockDeductedStatus(normalizedNewStatus);

    const shouldRestoreStock =
      isStockDeductedStatus(normalizedCurrentStatus) &&
      !isStockDeductedStatus(normalizedNewStatus);

    if (shouldDeductStock || shouldRestoreStock) {
      // Lấy danh sách order_items
      const { data: orderItems, error: itemsError } = await sb
        .from("order_items")
        .select("product_id, quantity")
        .eq("order_id", orderId);

      if (itemsError) throw itemsError;

      if (orderItems && orderItems.length > 0) {
        for (const item of orderItems) {
          if (shouldDeductStock) {
            // Kiểm tra tồn kho trước
            const { data: product, error: productError } = await sb
              .from("products")
              .select("stock_quantity, name")
              .eq("id", item.product_id)
              .single();

            if (productError) throw productError;

            if (product.stock_quantity < item.quantity) {
              return NextResponse.json(
                {
                  error: `Không đủ hàng trong kho cho sản phẩm: ${product.name}`,
                },
                { status: 400 },
              );
            }

            const { error: updateError } = await sb.rpc(
              "decrement_product_stock",
              {
                product_uuid: item.product_id,
                quantity_to_subtract: item.quantity,
              },
            );

            if (updateError) {
              console.error("Error deducting stock:", updateError);
              return NextResponse.json(
                { error: "Không thể trừ kho" },
                { status: 500 },
              );
            }
          }

          if (shouldRestoreStock) {
            const { error: updateError } = await sb.rpc(
              "increment_product_stock",
              {
                product_uuid: item.product_id,
                quantity_to_add: item.quantity,
              },
            );

            if (updateError) {
              console.error("Error restoring stock:", updateError);
              return NextResponse.json(
                { error: "Không thể hoàn kho" },
                { status: 500 },
              );
            }
          }
        }
      }
    }

    // Update order status
    const { data: updatedOrder, error: updateError } = await sb
      .from("orders")
      .update({
        status: normalizedNewStatus,
        updated_at: new Date().toISOString(),
      })
      .eq("id", orderId)
      .select()
      .single();

    if (updateError) throw updateError;

    // Log audit event
    await AuditLogger.orderStatusChanged(
      orderId,
      orderId.slice(0, 8).toUpperCase(),
      normalizedCurrentStatus,
      normalizedNewStatus,
      updatedOrder.customer_name,
    );

    // Log stock changes if applicable
    if (shouldRestoreStock) {
      await AuditLogger.systemEvent(
        `Đã hoàn trả hàng về kho do cập nhật trạng thái đơn #${orderId.slice(0, 8).toUpperCase()}`,
        { order_id: orderId },
      );
    } else if (shouldDeductStock) {
      await AuditLogger.systemEvent(
        `Đã trừ hàng khỏi kho do xác nhận đơn #${orderId.slice(0, 8).toUpperCase()}`,
        { order_id: orderId },
      );
    }

    let messageText = "Đã cập nhật trạng thái đơn hàng thành công";
    if (
      normalizedCurrentStatus === "delivered" &&
      normalizedNewStatus === "cancelled"
    ) {
      messageText = "Đã ghi nhận hoàn trả sau giao và hoàn hàng về kho";
    } else if (
      normalizedCurrentStatus === "pending" &&
      normalizedNewStatus === "cancelled"
    ) {
      messageText = "Đã hủy đơn chờ xác nhận";
    }

    return NextResponse.json({
      success: true,
      order: updatedOrder,
      message: messageText,
    });
  } catch (error: any) {
    console.error("Error updating order status:", error);
    return NextResponse.json(
      { error: error.message || "Failed to update order status" },
      { status: 500 },
    );
  }
}
