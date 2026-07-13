import { NextRequest, NextResponse } from "next/server";
import { AuditLogger } from "@/lib/auditLogger";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import { createServiceRoleSupabaseClient } from "@/lib/supabase-admin";
import {
  awardPointsForOrder,
  reversePointsForCancelledOrder,
} from "@/lib/loyalty";

type OrderStatus =
  | "pending"
  | "confirmed"
  | "shipping"
  | "completed"
  | "cancelled";

interface TransitionOrderStatusRpcClient {
  rpc(
    functionName: "transition_order_status",
    args: {
      p_order_id: string;
      p_new_status: OrderStatus;
      p_note: string | null;
      p_changed_by: string | null;
    },
  ): PromiseLike<{
    data: unknown;
    error: { code?: string; message?: string } | null;
  }>;
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

    const { orderId, newStatus, statusNote } = await request.json();
    const sb = createServiceRoleSupabaseClient();

    if (!orderId || !newStatus) {
      return NextResponse.json(
        { error: "Order ID và trạng thái mới là bắt buộc" },
        { status: 400 },
      );
    }

    if (!sb) {
      return NextResponse.json(
        { error: "Thiếu cấu hình SUPABASE_SERVICE_ROLE_KEY" },
        { status: 500 },
      );
    }

    // Validate status
    const validStatuses: OrderStatus[] = [
      "pending",
      "confirmed",
      "shipping",
      "completed",
      "cancelled",
    ];
    const normalizedNewStatus = newStatus as OrderStatus;
    if (!validStatuses.includes(normalizedNewStatus)) {
      return NextResponse.json(
        { error: "Trạng thái không hợp lệ" },
        { status: 400 },
      );
    }

    const transitionClient =
      sb as unknown as TransitionOrderStatusRpcClient;
    const { data: transitionData, error: transitionError } =
      await transitionClient.rpc("transition_order_status", {
        p_order_id: orderId,
        p_new_status: normalizedNewStatus,
        p_note: String(statusNote || "").trim().slice(0, 1200) || null,
        p_changed_by: user.email || user.id,
      });

    if (transitionError) {
      const isMissingFunction =
        transitionError.code === "PGRST202" || transitionError.code === "42883";
      return NextResponse.json(
        {
          error: isMissingFunction
            ? "Chưa cài đặt migration order_workflow_schema.sql trên Supabase"
            : transitionError.message || "Không thể cập nhật trạng thái đơn hàng",
        },
        { status: isMissingFunction ? 500 : 400 },
      );
    }

    if (!transitionData || typeof transitionData !== "object") {
      return NextResponse.json(
        { error: "Không nhận được dữ liệu đơn hàng sau khi cập nhật" },
        { status: 500 },
      );
    }

    const updatedOrder = transitionData as unknown as {
      id: string;
      customer_name: string;
      customer_phone?: string;
      total_amount?: number;
      status: OrderStatus;
      previous_status: OrderStatus;
      stock_restored: boolean;
      [key: string]: unknown;
    };

    const orderPhone = String(updatedOrder.customer_phone || "").trim();
    const orderAmount = Number(updatedOrder.total_amount || 0);

    if (
      updatedOrder.previous_status !== "completed" &&
      normalizedNewStatus === "completed" &&
      orderPhone
    ) {
      try {
        await awardPointsForOrder({
          sb,
          orderId,
          customerPhone: orderPhone,
          totalAmount: orderAmount,
          createdBy: user.email || user.id,
        });
      } catch (pointError) {
        console.warn("Không thể cộng điểm khi hoàn thành đơn:", pointError);
      }
    }

    if (
      updatedOrder.previous_status === "completed" &&
      normalizedNewStatus === "cancelled" &&
      orderPhone
    ) {
      try {
        await reversePointsForCancelledOrder({
          sb,
          orderId,
          customerPhone: orderPhone,
          createdBy: user.email || user.id,
        });
      } catch (pointError) {
        console.warn("Không thể trừ điểm khi hủy đơn hoàn thành:", pointError);
      }
    }

    // Log audit event
    await AuditLogger.orderStatusChanged(
      orderId,
      orderId.slice(0, 8).toUpperCase(),
      updatedOrder.previous_status,
      normalizedNewStatus,
      updatedOrder.customer_name,
    );

    if (updatedOrder.stock_restored) {
      await AuditLogger.systemEvent(
        `Đã hoàn trả hàng về kho do cập nhật trạng thái đơn #${orderId.slice(0, 8).toUpperCase()}`,
        { order_id: orderId },
      );
    }

    let messageText = "Đã cập nhật trạng thái đơn hàng thành công";
    if (
      updatedOrder.previous_status === "completed" &&
      normalizedNewStatus === "cancelled"
    ) {
      messageText = "Đã ghi nhận hoàn trả sau giao và hoàn hàng về kho";
    } else if (
      updatedOrder.previous_status === "pending" &&
      normalizedNewStatus === "cancelled"
    ) {
      messageText = "Đã hủy đơn chờ xác nhận và hoàn hàng về kho";
    } else if (
      (updatedOrder.previous_status === "confirmed" ||
        updatedOrder.previous_status === "shipping") &&
      normalizedNewStatus === "cancelled"
    ) {
      messageText = "Đã hủy đơn đang giao và hoàn hàng về kho";
    }

    return NextResponse.json({
      success: true,
      order: updatedOrder,
      message: messageText,
    });
  } catch (error: unknown) {
    console.error("Error updating order status:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Không thể cập nhật trạng thái đơn hàng",
      },
      { status: 500 },
    );
  }
}
