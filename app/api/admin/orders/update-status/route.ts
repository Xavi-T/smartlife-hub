import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { AuditLogger } from "@/lib/auditLogger";

export async function PATCH(request: NextRequest) {
  try {
    const { orderId, newStatus, currentStatus } = await request.json();

    if (!orderId || !newStatus) {
      return NextResponse.json(
        { error: "Order ID và trạng thái mới là bắt buộc" },
        { status: 400 },
      );
    }

    // Validate status
    const validStatuses = ["pending", "processing", "delivered", "cancelled"];
    if (!validStatuses.includes(newStatus)) {
      return NextResponse.json(
        { error: "Trạng thái không hợp lệ" },
        { status: 400 },
      );
    }

    // Logic hoàn trả kho khi HỦY đơn
    if (newStatus === "cancelled" && currentStatus !== "cancelled") {
      // Lấy danh sách order_items
      const { data: orderItems, error: itemsError } = await supabase
        .from("order_items")
        .select("product_id, quantity")
        .eq("order_id", orderId);

      if (itemsError) throw itemsError;

      // Hoàn trả stock cho từng sản phẩm
      if (orderItems && orderItems.length > 0) {
        for (const item of orderItems) {
          const { error: updateError } = await supabase.rpc(
            "increment_product_stock",
            {
              product_uuid: item.product_id,
              quantity_to_add: item.quantity,
            },
          );

          if (updateError) {
            console.error("Error restoring stock:", updateError);
            // Continue với các items khác
          }
        }
      }
    }

    // Logic trừ kho khi chuyển từ PENDING sang PROCESSING (Đã xác nhận)
    if (newStatus === "processing" && currentStatus === "pending") {
      // Lấy danh sách order_items
      const { data: orderItems, error: itemsError } = await supabase
        .from("order_items")
        .select("product_id, quantity")
        .eq("order_id", orderId);

      if (itemsError) throw itemsError;

      // Trừ stock cho từng sản phẩm
      if (orderItems && orderItems.length > 0) {
        for (const item of orderItems) {
          // Kiểm tra tồn kho trước
          const { data: product, error: productError } = await supabase
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

          // Trừ stock
          const { error: updateError } = await supabase.rpc(
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
      }
    }

    // Update order status
    const { data: updatedOrder, error: updateError } = await supabase
      .from("orders")
      .update({
        status: newStatus,
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
      currentStatus,
      newStatus,
      updatedOrder.customer_name,
    );

    // Log stock changes if applicable
    if (newStatus === "cancelled" && currentStatus !== "cancelled") {
      await AuditLogger.systemEvent(
        `Đã hoàn trả hàng về kho do hủy đơn #${orderId.slice(0, 8).toUpperCase()}`,
        { order_id: orderId },
      );
    } else if (newStatus === "processing" && currentStatus === "pending") {
      await AuditLogger.systemEvent(
        `Đã trừ hàng khỏi kho do xác nhận đơn #${orderId.slice(0, 8).toUpperCase()}`,
        { order_id: orderId },
      );
    }

    return NextResponse.json({
      success: true,
      order: updatedOrder,
      message: `Đã cập nhật trạng thái đơn hàng thành công`,
    });
  } catch (error: any) {
    console.error("Error updating order status:", error);
    return NextResponse.json(
      { error: error.message || "Failed to update order status" },
      { status: 500 },
    );
  }
}
