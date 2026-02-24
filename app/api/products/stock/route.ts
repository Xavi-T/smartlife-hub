import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export async function PATCH(request: NextRequest) {
  try {
    const sb = supabase as any;
    const { productId, quantity } = await request.json();

    if (!productId || quantity === undefined) {
      return NextResponse.json(
        { error: "Product ID and quantity are required" },
        { status: 400 },
      );
    }

    // Lấy số lượng hiện tại
    const { data: product, error: fetchError } = await sb
      .from("products")
      .select("stock_quantity")
      .eq("id", productId)
      .single();

    if (fetchError) throw fetchError;

    const productRow = (product || null) as { stock_quantity: number } | null;

    // Cộng thêm số lượng
    const newQuantity = (productRow?.stock_quantity || 0) + quantity;

    const { data, error: updateError } = await sb
      .from("products")
      .update({ stock_quantity: newQuantity })
      .eq("id", productId)
      .select()
      .single();

    if (updateError) throw updateError;

    return NextResponse.json(data);
  } catch (error) {
    console.error("Error updating stock:", error);
    return NextResponse.json(
      { error: "Failed to update stock" },
      { status: 500 },
    );
  }
}
