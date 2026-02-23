import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";

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

function toSegmentKey(segmentLabel: string) {
  return segmentLabel
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .replace(/_{2,}/g, "_")
    .slice(0, 50);
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

    const adminClient = createAdminPriorityCustomersClient() as any;
    const { data, error } = await adminClient
      .from("customer_segment_settings")
      .select("*")
      .order("min_delivered_orders", { ascending: true })
      .order("segment_label", { ascending: true });

    if (error) throw error;

    return NextResponse.json({ segments: data || [] });
  } catch (error: any) {
    console.error("Error fetching segment settings:", error);
    return NextResponse.json(
      { error: error.message || "Không thể tải phân loại khách hàng" },
      { status: 500 },
    );
  }
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

    const body = await request.json();
    const updates = Array.isArray(body.updates) ? body.updates : [];

    if (!updates.length) {
      return NextResponse.json(
        { error: "Không có dữ liệu cập nhật" },
        { status: 400 },
      );
    }

    const adminClient = createAdminPriorityCustomersClient() as any;

    for (const item of updates) {
      const discountPercent = Number(item.discountPercent || 0);
      if (
        !Number.isFinite(discountPercent) ||
        discountPercent < 0 ||
        discountPercent > 100
      ) {
        return NextResponse.json(
          {
            error: `% giảm giá không hợp lệ cho phân loại ${item.segmentLabel || ""}`,
          },
          { status: 400 },
        );
      }

      const payload = {
        segment_label: item.segmentLabel,
        min_delivered_orders: Number(item.minDeliveredOrders || 0),
        min_total_spent: Number(item.minTotalSpent || 0),
        discount_percent: discountPercent,
        is_priority: Boolean(item.isPriority),
      };

      const { error } = await adminClient
        .from("customer_segment_settings")
        .update(payload)
        .eq("id", item.id);

      if (error) throw error;
    }

    const { data, error } = await adminClient
      .from("customer_segment_settings")
      .select("*")
      .order("min_delivered_orders", { ascending: true })
      .order("segment_label", { ascending: true });

    if (error) throw error;

    return NextResponse.json({
      success: true,
      segments: data || [],
      message: "Đã cập nhật phân loại khách hàng",
    });
  } catch (error: any) {
    console.error("Error updating segment settings:", error);
    return NextResponse.json(
      { error: error.message || "Không thể cập nhật phân loại khách hàng" },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const authClient = await createServerSupabaseClient();
    const {
      data: { user },
    } = await authClient.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const segmentLabel = String(body.segmentLabel || "").trim();
    const minDeliveredOrders = Number(body.minDeliveredOrders || 0);
    const minTotalSpent = Number(body.minTotalSpent || 0);
    const discountPercent = Number(body.discountPercent || 0);
    const isPriority = body.isPriority !== false;

    if (!segmentLabel) {
      return NextResponse.json(
        { error: "Tên phân loại là bắt buộc" },
        { status: 400 },
      );
    }

    const segmentKey = toSegmentKey(segmentLabel);
    if (!segmentKey) {
      return NextResponse.json(
        { error: "Tên phân loại không hợp lệ" },
        { status: 400 },
      );
    }

    if (
      !Number.isFinite(discountPercent) ||
      discountPercent < 0 ||
      discountPercent > 100
    ) {
      return NextResponse.json(
        { error: "% giảm giá phải nằm trong khoảng 0-100" },
        { status: 400 },
      );
    }

    const adminClient = createAdminPriorityCustomersClient() as any;

    const { data: existingSegment } = await adminClient
      .from("customer_segment_settings")
      .select("id")
      .eq("segment_key", segmentKey)
      .maybeSingle();

    if (existingSegment) {
      return NextResponse.json(
        {
          error:
            "Tên phân loại này đã tồn tại (trùng mã nội bộ). Vui lòng đổi tên khác.",
        },
        { status: 400 },
      );
    }

    const { data, error } = await adminClient
      .from("customer_segment_settings")
      .insert({
        segment_key: segmentKey,
        segment_label: segmentLabel,
        min_delivered_orders: minDeliveredOrders,
        min_total_spent: minTotalSpent,
        discount_percent: discountPercent,
        is_priority: isPriority,
        sort_order: minDeliveredOrders,
      })
      .select("*")
      .single();

    if (error) throw error;

    return NextResponse.json({
      success: true,
      segment: data,
      message: "Đã tạo phân loại khách hàng",
    });
  } catch (error: any) {
    console.error("Error creating segment settings:", error);
    return NextResponse.json(
      { error: error.message || "Không thể tạo phân loại khách hàng" },
      { status: 500 },
    );
  }
}
