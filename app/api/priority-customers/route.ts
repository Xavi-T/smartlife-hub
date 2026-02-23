import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

type PublicPriorityCustomer = {
  id: string;
  customer_name: string;
  customer_phone_masked: string;
  customer_segment: string;
  discount_percent: number;
  is_active: boolean;
};

function maskPhone(phone: string): string {
  const normalized = String(phone || "").replace(/\D/g, "");
  if (!normalized) return "***";
  const last3 = normalized.slice(-3);
  return `***${last3}`;
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const search = (searchParams.get("search") || "").trim().toLowerCase();

    const { data, error } = await supabase
      .from("priority_customers")
      .select(
        "id, customer_name, customer_phone, customer_segment, discount_percent, is_active",
      )
      .eq("is_active", true)
      .order("updated_at", { ascending: false })
      .limit(100);

    if (error) throw error;

    let customers = (
      (data || []) as Array<{
        id: string;
        customer_name: string;
        customer_phone: string;
        customer_segment: string;
        discount_percent: number;
        is_active: boolean;
      }>
    ).map((customer) => ({
      id: customer.id,
      customer_name: customer.customer_name,
      customer_phone_masked: maskPhone(customer.customer_phone),
      customer_segment: customer.customer_segment,
      discount_percent: Number(customer.discount_percent || 0),
      is_active: customer.is_active,
    }));

    if (search) {
      customers = customers.filter((customer) =>
        customer.customer_name.toLowerCase().includes(search),
      );
    }

    return NextResponse.json({ customers });
  } catch (error: any) {
    console.error("Error fetching public priority customers:", error);
    return NextResponse.json(
      { error: error.message || "Không thể tải danh sách khách hàng ưu tiên" },
      { status: 500 },
    );
  }
}
