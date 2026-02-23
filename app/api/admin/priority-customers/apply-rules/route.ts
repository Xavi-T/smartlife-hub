import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";

type AggregatedCustomer = {
  customer_phone: string;
  customer_name: string;
  total_orders: number;
  delivered_orders: number;
  total_spent: number;
  last_order_at: string;
};

type OrderRow = {
  customer_name: string;
  customer_phone: string;
  status: string;
  total_amount: number;
  created_at: string;
};

type SegmentRow = {
  id: string;
  segment_key: string;
  min_delivered_orders: number;
  min_total_spent: number;
  discount_percent: number;
  sort_order: number;
};

type PriorityUpsertRow = {
  customer_phone: string;
  customer_name: string;
  customer_segment: string;
  discount_percent: number;
  total_orders_snapshot: number;
  delivered_orders_snapshot: number;
  total_spent_snapshot: number;
  source: string;
  is_active: boolean;
  last_order_at: string;
};

function createAdminPriorityCustomersClient() {
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

function normalizePhone(phone: string) {
  return phone.replace(/\D/g, "");
}

export async function POST() {
  try {
    const authClient = await createServerSupabaseClient();
    const {
      data: { user },
    } = await authClient.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const adminClient = createAdminPriorityCustomersClient() as any;

    const [
      { data: orders, error: ordersError },
      { data: segments, error: segmentsError },
    ] = await Promise.all([
      adminClient
        .from("orders")
        .select(
          "customer_name, customer_phone, status, total_amount, created_at",
        )
        .order("created_at", { ascending: false }),
      adminClient
        .from("customer_segment_settings")
        .select("*")
        .eq("is_priority", true)
        .order("sort_order", { ascending: true }),
    ]);

    if (ordersError) throw ordersError;
    if (segmentsError) throw segmentsError;

    const segmentList: SegmentRow[] = (segments || []) as SegmentRow[];
    if (!segmentList.length) {
      return NextResponse.json(
        { error: "Chưa có phân loại ưu tiên đang bật" },
        { status: 400 },
      );
    }

    const aggregationMap = new Map<string, AggregatedCustomer>();

    const orderRows: OrderRow[] = (orders || []) as OrderRow[];

    orderRows.forEach((order) => {
      const phone = normalizePhone(order.customer_phone || "");
      if (!phone) return;

      const existing = aggregationMap.get(phone);
      if (!existing) {
        aggregationMap.set(phone, {
          customer_phone: phone,
          customer_name: order.customer_name,
          total_orders: 1,
          delivered_orders: order.status === "delivered" ? 1 : 0,
          total_spent:
            order.status === "delivered" ? Number(order.total_amount || 0) : 0,
          last_order_at: order.created_at,
        });
        return;
      }

      existing.total_orders += 1;
      if (order.status === "delivered") {
        existing.delivered_orders += 1;
        existing.total_spent += Number(order.total_amount || 0);
      }

      if (new Date(order.created_at) > new Date(existing.last_order_at)) {
        existing.last_order_at = order.created_at;
      }
    });

    const candidates = Array.from(aggregationMap.values());
    const upsertRows: PriorityUpsertRow[] = candidates
      .map((customer) => {
        const matchedSegment = [...segmentList]
          .sort((a, b) => b.sort_order - a.sort_order)
          .find(
            (segment) =>
              customer.delivered_orders >=
                Number(segment.min_delivered_orders || 0) &&
              customer.total_spent >= Number(segment.min_total_spent || 0),
          );

        if (!matchedSegment) return null;

        return {
          customer_phone: customer.customer_phone,
          customer_name: customer.customer_name,
          customer_segment: matchedSegment.segment_key,
          discount_percent: Number(matchedSegment.discount_percent || 0),
          total_orders_snapshot: customer.total_orders,
          delivered_orders_snapshot: customer.delivered_orders,
          total_spent_snapshot: customer.total_spent,
          source: "auto",
          is_active: true,
          last_order_at: customer.last_order_at,
        };
      })
      .filter((item): item is PriorityUpsertRow => item !== null);

    if (!upsertRows.length) {
      return NextResponse.json({
        success: true,
        affected: 0,
        message: "Không có khách hàng nào đạt điều kiện ưu tiên",
      });
    }

    const { error: upsertError } = await adminClient
      .from("priority_customers")
      .upsert(upsertRows, { onConflict: "customer_phone" });

    if (upsertError) throw upsertError;

    return NextResponse.json({
      success: true,
      affected: upsertRows.length,
      message: `Đã đồng bộ ${upsertRows.length} khách hàng ưu tiên theo điều kiện`,
    });
  } catch (error: any) {
    console.error("Error applying priority customer rules:", error);
    return NextResponse.json(
      {
        error:
          error.message || "Không thể áp dụng điều kiện khách hàng ưu tiên",
      },
      { status: 500 },
    );
  }
}
