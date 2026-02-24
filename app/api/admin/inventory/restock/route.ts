import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export async function PATCH(request: NextRequest) {
  try {
    const sb = supabase as any;
    const { productId, quantityToAdd } = await request.json();

    if (!productId || !quantityToAdd || quantityToAdd <= 0) {
      return NextResponse.json(
        { error: "Product ID và số lượng hợp lệ là bắt buộc" },
        { status: 400 },
      );
    }

    // Lấy số lượng hiện tại
    const { data: product, error: fetchError } = await sb
      .from("products")
      .select("stock_quantity, name")
      .eq("id", productId)
      .single();

    if (fetchError) throw fetchError;

    const productRow = (product || null) as {
      stock_quantity: number;
      name: string;
    } | null;

    // Cộng thêm số lượng
    const newQuantity = (productRow?.stock_quantity || 0) + quantityToAdd;

    const { data, error: updateError } = await sb
      .from("products")
      .update({
        stock_quantity: newQuantity,
      })
      .eq("id", productId)
      .select()
      .single();

    if (updateError) throw updateError;

    return NextResponse.json({
      success: true,
      message: `Đã nhập thêm ${quantityToAdd} ${productRow?.name || "sản phẩm"}`,
      product: data,
    });
  } catch (error) {
    console.error("Error restocking product:", error);
    return NextResponse.json({ error: "Không thể nhập hàng" }, { status: 500 });
  }
}
