import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { AuditLogger } from "@/lib/auditLogger";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";

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

    const { orderId, paymentConfirmed } = await request.json();
    const sb = createAdminOrdersClient();

    if (!orderId || typeof paymentConfirmed !== "boolean") {
      return NextResponse.json(
        { error: "orderId và paymentConfirmed là bắt buộc" },
        { status: 400 },
      );
    }

    const { data: orderData, error: orderError } = await sb
      .from("orders")
      .select("*")
      .eq("id", orderId)
      .single();

    const order = orderData as {
      id: string;
      customer_name: string;
      payment_method?: string | null;
    } | null;

    if (orderError || !order) {
      return NextResponse.json(
        { error: "Không tìm thấy đơn hàng" },
        { status: 404 },
      );
    }

    if (order.payment_method !== "bank_transfer") {
      return NextResponse.json(
        { error: "Chỉ đơn chuyển khoản mới cần xác nhận thanh toán" },
        { status: 400 },
      );
    }

    const { data: updatedOrder, error: updateError } = await sb
      .from("orders")
      .update({
        payment_confirmed: paymentConfirmed,
        payment_confirmed_at: paymentConfirmed
          ? new Date().toISOString()
          : null,
        payment_confirmed_by: paymentConfirmed ? "admin" : null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", orderId)
      .select()
      .single();

    if (updateError) throw updateError;

    await AuditLogger.systemEvent(
      `${paymentConfirmed ? "Đã xác nhận" : "Đã bỏ xác nhận"} thanh toán chuyển khoản cho đơn #${orderId.slice(0, 8).toUpperCase()}`,
      { order_id: orderId },
    );

    return NextResponse.json({
      success: true,
      order: updatedOrder,
      message: paymentConfirmed
        ? "Đã xác nhận thanh toán"
        : "Đã bỏ xác nhận thanh toán",
    });
  } catch (error: unknown) {
    console.error("Error confirming payment:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Không thể xác nhận thanh toán",
      },
      { status: 500 },
    );
  }
}
