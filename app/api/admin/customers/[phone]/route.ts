import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";

function createAdminCustomersClient() {
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;

  if (!serviceRoleKey || !supabaseUrl) {
    return supabase;
  }

  return createClient<Database>(supabaseUrl, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ phone: string }> },
) {
  try {
    const authClient = await createServerSupabaseClient();
    const {
      data: { user },
    } = await authClient.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { phone: rawPhone } = await params;
    const phone = decodeURIComponent(rawPhone);
    const normalizedPhone = phone.replace(/\D/g, "");
    const adminCustomersClient = createAdminCustomersClient();

    // Lấy tất cả đơn hàng của khách hàng này
    const { data: orders, error } = await adminCustomersClient
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
      .or(`customer_phone.eq.${normalizedPhone},customer_phone.eq.${phone}`)
      .order("created_at", { ascending: false });

    if (error) throw error;

    const deliveredOrders = orders.filter((o) => o.status === "delivered");
    const deliveredRevenue = deliveredOrders.reduce(
      (sum, o) => sum + o.total_amount,
      0,
    );

    // Tính thống kê
    const stats = {
      totalOrders: orders.length,
      totalSpent: deliveredRevenue,
      pendingOrders: orders.filter((o) => o.status === "pending").length,
      processingOrders: orders.filter((o) => o.status === "processing").length,
      deliveredOrders: deliveredOrders.length,
      cancelledOrders: orders.filter((o) => o.status === "cancelled").length,
      averageOrderValue:
        deliveredOrders.length > 0
          ? deliveredRevenue / deliveredOrders.length
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
