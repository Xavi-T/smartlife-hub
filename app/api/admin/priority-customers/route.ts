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

function normalizePhone(phone: string) {
  return phone.replace(/\D/g, "");
}

export async function GET(request: NextRequest) {
  try {
    const authClient = await createServerSupabaseClient();
    const {
      data: { user },
    } = await authClient.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const search = (searchParams.get("search") || "").trim().toLowerCase();
    const segment = searchParams.get("segment") || "all";
    const active = searchParams.get("active") || "all";

    const adminClient = createAdminPriorityCustomersClient() as any;

    const { data, error } = await adminClient
      .from("priority_customers")
      .select("*")
      .order("updated_at", { ascending: false });

    if (error) throw error;

    let customers: Array<{
      id: string;
      customer_phone: string;
      customer_name: string;
      customer_segment: string;
      discount_percent: number;
      is_active: boolean;
    }> = (data || []) as Array<{
      id: string;
      customer_phone: string;
      customer_name: string;
      customer_segment: string;
      discount_percent: number;
      is_active: boolean;
    }>;

    if (search) {
      customers = customers.filter(
        (customer) =>
          customer.customer_name.toLowerCase().includes(search) ||
          customer.customer_phone.includes(search),
      );
    }

    if (segment !== "all") {
      customers = customers.filter(
        (customer) => customer.customer_segment === segment,
      );
    }

    if (active !== "all") {
      const isActive = active === "active";
      customers = customers.filter(
        (customer) => customer.is_active === isActive,
      );
    }

    const stats = {
      total: customers.length,
      active: customers.filter((customer) => customer.is_active).length,
      inactive: customers.filter((customer) => !customer.is_active).length,
      bySegment: customers.reduce<Record<string, number>>(
        (result, customer) => {
          result[customer.customer_segment] =
            (result[customer.customer_segment] || 0) + 1;
          return result;
        },
        {},
      ),
    };

    return NextResponse.json({ customers, stats });
  } catch (error: any) {
    console.error("Error fetching priority customers:", error);
    return NextResponse.json(
      { error: error.message || "Không thể tải danh sách khách hàng ưu tiên" },
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
    const customerName = (body.customerName || "").trim();
    const customerPhone = normalizePhone(String(body.customerPhone || ""));
    const customerSegment = String(body.customerSegment || "regular").trim();
    const notes = body.notes ? String(body.notes).trim() : null;
    const isActive = body.isActive !== false;

    if (!customerName || !customerPhone) {
      return NextResponse.json(
        { error: "Tên khách hàng và số điện thoại là bắt buộc" },
        { status: 400 },
      );
    }

    const adminClient = createAdminPriorityCustomersClient() as any;

    const { data: segment, error: segmentError } = await adminClient
      .from("customer_segment_settings")
      .select("discount_percent")
      .eq("segment_key", customerSegment)
      .single();

    if (segmentError || !segment) {
      return NextResponse.json(
        { error: "Phân loại khách hàng không tồn tại" },
        { status: 400 },
      );
    }

    const { data, error } = await adminClient
      .from("priority_customers")
      .insert({
        customer_name: customerName,
        customer_phone: customerPhone,
        customer_segment: customerSegment,
        discount_percent: Number(segment.discount_percent || 0),
        notes,
        is_active: isActive,
        source: "manual",
      })
      .select("*")
      .single();

    if (error) throw error;

    return NextResponse.json({
      success: true,
      customer: data,
      message: "Đã thêm khách hàng ưu tiên",
    });
  } catch (error: any) {
    console.error("Error creating priority customer:", error);
    return NextResponse.json(
      { error: error.message || "Không thể tạo khách hàng ưu tiên" },
      { status: 500 },
    );
  }
}
