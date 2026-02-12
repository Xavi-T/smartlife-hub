import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export async function GET(
  request: NextRequest,
  { params }: { params: { phone: string } },
) {
  try {
    const phone = decodeURIComponent(params.phone);

    // Lấy tất cả đơn hàng của khách hàng này
    const { data: orders, error } = await supabase
      .from("orders")
      .select(
        `
        *,
        order_items(
          id,
          quantity,
          unit_price,
          subtotal,
          products(
            id,
            name,
            image_url,
            category
          )
        )
      `,
      )
      .eq("customer_phone", phone)
      .order("created_at", { ascending: false });

    if (error) throw error;

    // Tính thống kê
    const stats = {
      totalOrders: orders.length,
      totalSpent: orders
        .filter((o) => o.status === "delivered")
        .reduce((sum, o) => sum + o.total_amount, 0),
      pendingOrders: orders.filter((o) => o.status === "pending").length,
      processingOrders: orders.filter((o) => o.status === "processing").length,
      deliveredOrders: orders.filter((o) => o.status === "delivered").length,
      cancelledOrders: orders.filter((o) => o.status === "cancelled").length,
      averageOrderValue:
        orders.length > 0
          ? orders
              .filter((o) => o.status === "delivered")
              .reduce((sum, o) => sum + o.total_amount, 0) /
            orders.filter((o) => o.status === "delivered").length
          : 0,
      firstOrderDate:
        orders.length > 0 ? orders[orders.length - 1].created_at : null,
      lastOrderDate: orders.length > 0 ? orders[0].created_at : null,
    };

    // Phân loại
    let customerType = "Khách mới";
    let typeColor = "yellow";

    if (stats.totalOrders >= 3) {
      customerType = "Khách thân thiết";
      typeColor = "purple";
    } else if (stats.totalOrders >= 2) {
      customerType = "Khách quen";
      typeColor = "blue";
    }

    return NextResponse.json({
      customer: {
        name: orders[0]?.customer_name || "N/A",
        phone: phone,
        address: orders[0]?.customer_address || "N/A",
        customerType,
        typeColor,
      },
      stats,
      orders,
    });
  } catch (error: any) {
    console.error("Error fetching customer detail:", error);
    return NextResponse.json(
      { error: error.message || "Không thể tải thông tin khách hàng" },
      { status: 500 },
    );
  }
}
