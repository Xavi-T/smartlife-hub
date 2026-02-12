import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export async function GET() {
  try {
    const { data: orders, error } = await supabase
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
      .order("created_at", { ascending: false });

    if (error) throw error;

    return NextResponse.json(orders);
  } catch (error) {
    console.error("Error fetching orders:", error);
    return NextResponse.json(
      { error: "Failed to fetch orders" },
      { status: 500 },
    );
  }
}
