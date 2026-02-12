import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

interface DashboardStats {
  totalRevenue: number;
  totalProfit: number;
  growthRate: number;
  monthlyRevenue: number;
  previousMonthRevenue: number;
}

export async function GET() {
  try {
    const now = new Date();
    const firstDayThisMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const firstDayLastMonth = new Date(
      now.getFullYear(),
      now.getMonth() - 1,
      1,
    );
    const firstDayThisMonthISO = firstDayThisMonth.toISOString();
    const firstDayLastMonthISO = firstDayLastMonth.toISOString();

    // 1. Tổng doanh thu từ đơn hàng "delivered"
    const { data: revenueData, error: revenueError } = await supabase
      .from("orders")
      .select("total_amount")
      .eq("status", "delivered");

    if (revenueError) throw revenueError;

    const totalRevenue =
      revenueData?.reduce(
        (sum, order) => sum + Number(order.total_amount),
        0,
      ) || 0;

    // 2. Tổng lợi nhuận: SUM((unit_price - cost_price) * quantity)
    const { data: profitData, error: profitError } = await supabase.from(
      "order_items",
    ).select(`
        quantity,
        unit_price,
        order_id,
        product_id,
        products!inner(cost_price),
        orders!inner(status)
      `);

    if (profitError) throw profitError;

    const totalProfit =
      profitData
        ?.filter((item: any) => item.orders.status === "delivered")
        .reduce((sum, item: any) => {
          const profit =
            (Number(item.unit_price) - Number(item.products.cost_price)) *
            Number(item.quantity);
          return sum + profit;
        }, 0) || 0;

    // 3. Doanh thu tháng này
    const { data: thisMonthData, error: thisMonthError } = await supabase
      .from("orders")
      .select("total_amount")
      .eq("status", "delivered")
      .gte("created_at", firstDayThisMonthISO);

    if (thisMonthError) throw thisMonthError;

    const monthlyRevenue =
      thisMonthData?.reduce(
        (sum, order) => sum + Number(order.total_amount),
        0,
      ) || 0;

    // 4. Doanh thu tháng trước
    const { data: lastMonthData, error: lastMonthError } = await supabase
      .from("orders")
      .select("total_amount")
      .eq("status", "delivered")
      .gte("created_at", firstDayLastMonthISO)
      .lt("created_at", firstDayThisMonthISO);

    if (lastMonthError) throw lastMonthError;

    const previousMonthRevenue =
      lastMonthData?.reduce(
        (sum, order) => sum + Number(order.total_amount),
        0,
      ) || 0;

    // 5. Tỷ lệ tăng trưởng
    const growthRate =
      previousMonthRevenue > 0
        ? ((monthlyRevenue - previousMonthRevenue) / previousMonthRevenue) * 100
        : monthlyRevenue > 0
          ? 100
          : 0;

    const stats: DashboardStats = {
      totalRevenue,
      totalProfit,
      growthRate: Math.round(growthRate * 100) / 100, // 2 chữ số thập phân
      monthlyRevenue,
      previousMonthRevenue,
    };

    return NextResponse.json(stats);
  } catch (error) {
    console.error("Error fetching dashboard stats:", error);
    return NextResponse.json(
      { error: "Failed to fetch dashboard stats" },
      { status: 500 },
    );
  }
}
