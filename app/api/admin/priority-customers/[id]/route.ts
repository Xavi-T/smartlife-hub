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

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const authClient = await createServerSupabaseClient();
    const {
      data: { user },
    } = await authClient.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const body = await request.json();

    const updatePayload: Record<string, unknown> = {};

    if (typeof body.customerName === "string") {
      updatePayload.customer_name = body.customerName.trim();
    }
    if (typeof body.customerPhone === "string") {
      updatePayload.customer_phone = normalizePhone(body.customerPhone);
    }
    const normalizedCustomerSegment =
      typeof body.customerSegment === "string"
        ? body.customerSegment.trim()
        : null;
    if (typeof body.customerSegment === "string") {
      updatePayload.customer_segment = normalizedCustomerSegment;
    }
    if (body.notes !== undefined) {
      updatePayload.notes = body.notes ? String(body.notes).trim() : null;
    }
    if (typeof body.isActive === "boolean") {
      updatePayload.is_active = body.isActive;
    }

    const adminClient = createAdminPriorityCustomersClient() as any;

    if (normalizedCustomerSegment) {
      const { data: segment, error: segmentError } = await adminClient
        .from("customer_segment_settings")
        .select("discount_percent")
        .eq("segment_key", normalizedCustomerSegment)
        .single();

      if (segmentError || !segment) {
        return NextResponse.json(
          { error: "Phân loại khách hàng không tồn tại" },
          { status: 400 },
        );
      }

      updatePayload.discount_percent = Number(segment.discount_percent || 0);
    }
    const { data, error } = await adminClient
      .from("priority_customers")
      .update(updatePayload)
      .eq("id", id)
      .select("*")
      .single();

    if (error) throw error;

    return NextResponse.json({
      success: true,
      customer: data,
      message: "Đã cập nhật khách hàng ưu tiên",
    });
  } catch (error: any) {
    console.error("Error updating priority customer:", error);
    return NextResponse.json(
      { error: error.message || "Không thể cập nhật khách hàng ưu tiên" },
      { status: 500 },
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const authClient = await createServerSupabaseClient();
    const {
      data: { user },
    } = await authClient.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const adminClient = createAdminPriorityCustomersClient() as any;

    const { error } = await adminClient
      .from("priority_customers")
      .delete()
      .eq("id", id);

    if (error) throw error;

    return NextResponse.json({
      success: true,
      message: "Đã xóa khách hàng ưu tiên",
    });
  } catch (error: any) {
    console.error("Error deleting priority customer:", error);
    return NextResponse.json(
      { error: error.message || "Không thể xóa khách hàng ưu tiên" },
      { status: 500 },
    );
  }
}
