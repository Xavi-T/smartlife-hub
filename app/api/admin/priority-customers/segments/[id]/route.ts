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

    const { data: segment, error: segmentError } = await adminClient
      .from("customer_segment_settings")
      .select("segment_key")
      .eq("id", id)
      .single();

    if (segmentError) throw segmentError;

    const { error: customersError } = await adminClient
      .from("priority_customers")
      .update({
        customer_segment: "regular",
        discount_percent: 0,
      })
      .eq("customer_segment", segment.segment_key);

    if (customersError) throw customersError;

    const { error } = await adminClient
      .from("customer_segment_settings")
      .delete()
      .eq("id", id);

    if (error) throw error;

    return NextResponse.json({
      success: true,
      message: "Đã xóa phân loại khách hàng",
    });
  } catch (error: any) {
    console.error("Error deleting segment settings:", error);
    return NextResponse.json(
      { error: error.message || "Không thể xóa phân loại khách hàng" },
      { status: 500 },
    );
  }
}
