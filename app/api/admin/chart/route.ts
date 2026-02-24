import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";

interface ChartData {
  date: string;
  revenue: number;
  orders: number;
}

function createAdminDashboardClient() {
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

export async function GET() {
  try {
    const authClient = await createServerSupabaseClient();
    const {
      data: { user },
    } = await authClient.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const sb = createAdminDashboardClient();
    // Lấy dữ liệu 7 ngày gần nhất
    const today = new Date();
    const sevenDaysAgo = new Date(today);
    sevenDaysAgo.setDate(today.getDate() - 6);

    const startDate = sevenDaysAgo.toISOString().split("T")[0];

    const { data: ordersData, error } = await sb
      .from("orders")
      .select("created_at, total_amount, status")
      .eq("status", "delivered")
      .gte("created_at", startDate)
      .order("created_at", { ascending: true });

    if (error) throw error;

    const orders = (ordersData || []) as Array<{
      created_at: string;
      total_amount: number;
      status: string;
    }>;

    // Group by date và tính tổng
    const chartData: { [key: string]: ChartData } = {};

    // Khởi tạo 7 ngày
    for (let i = 0; i < 7; i++) {
      const date = new Date(sevenDaysAgo);
      date.setDate(sevenDaysAgo.getDate() + i);
      const dateStr = date.toISOString().split("T")[0];
      const displayDate = `${date.getDate()}/${date.getMonth() + 1}`;

      chartData[dateStr] = {
        date: displayDate,
        revenue: 0,
        orders: 0,
      };
    }

    // Aggregate data
    orders.forEach((order) => {
      const dateStr = order.created_at.split("T")[0];
      if (chartData[dateStr]) {
        chartData[dateStr].revenue += Number(order.total_amount);
        chartData[dateStr].orders += 1;
      }
    });

    // Convert to array
    const result = Object.values(chartData);

    return NextResponse.json(result);
  } catch (error) {
    console.error("Error fetching chart data:", error);
    return NextResponse.json(
      { error: "Failed to fetch chart data" },
      { status: 500 },
    );
  }
}
