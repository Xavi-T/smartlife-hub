import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import type { DashboardStats } from "@/types/database";

export async function GET() {
  try {
    // Lấy dữ liệu từ view product_sales_summary
    const { data: salesData, error: salesError } = await supabase
      .from("product_sales_summary")
      .select("*");

    if (salesError) throw salesError;

    // Tính tổng doanh thu và lợi nhuận từ các đơn đã giao
    const totalRevenue =
      salesData?.reduce((sum, item) => sum + (item.total_revenue || 0), 0) || 0;
    const totalProfit =
      salesData?.reduce((sum, item) => sum + (item.total_profit || 0), 0) || 0;

    // Lấy số đơn hàng trong tháng hiện tại
    const currentMonth = new Date();
    const firstDayOfMonth = new Date(
      currentMonth.getFullYear(),
      currentMonth.getMonth(),
      1,
    );

    const { data: ordersData, error: ordersError } = await supabase
      .from("orders")
      .select("id", { count: "exact", head: true })
      .gte("created_at", firstDayOfMonth.toISOString())
      .neq("status", "cancelled");

    if (ordersError) throw ordersError;

    // Đếm sản phẩm có tồn kho < 5
    const { data: lowStockData, error: lowStockError } = await supabase
      .from("products")
      .select("id", { count: "exact", head: true })
      .lt("stock_quantity", 5)
      .eq("is_active", true);

    if (lowStockError) throw lowStockError;

    const stats: DashboardStats = {
      totalRevenue,
      totalProfit,
      monthlyOrders: ordersData?.length || 0,
      lowStockProducts: lowStockData?.length || 0,
    };

    return NextResponse.json(stats);
  } catch (error) {
    console.error("Error fetching statistics:", error);
    return NextResponse.json(
      { error: "Failed to fetch statistics" },
      { status: 500 },
    );
  }
}
