import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { AuditLogger } from "@/lib/auditLogger";

// POST: Ghi nhận nhập hàng
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { productId, quantityAdded, costPriceAtTime, supplier, notes } = body;

    // Validation
    if (!productId || !quantityAdded || !costPriceAtTime) {
      return NextResponse.json(
        { error: "Product ID, số lượng và giá vốn là bắt buộc" },
        { status: 400 },
      );
    }

    if (quantityAdded <= 0) {
      return NextResponse.json(
        { error: "Số lượng nhập phải lớn hơn 0" },
        { status: 400 },
      );
    }

    if (costPriceAtTime < 0) {
      return NextResponse.json(
        { error: "Giá vốn không được âm" },
        { status: 400 },
      );
    }

    // Gọi function xử lý nhập hàng
    const { data, error } = await supabase.rpc("process_stock_inbound", {
      p_product_id: productId,
      p_quantity_added: quantityAdded,
      p_cost_price_at_time: costPriceAtTime,
      p_supplier: supplier || null,
      p_notes: notes || null,
    });

    if (error) throw error;

    // Get product info for logging
    const { data: product } = await supabase
      .from("products")
      .select("name")
      .eq("id", productId)
      .single();

    // Log audit event
    if (product) {
      await AuditLogger.stockInbound(
        productId,
        product.name,
        quantityAdded,
        costPriceAtTime,
        supplier,
      );
    }

    return NextResponse.json({
      success: true,
      message: "Nhập hàng thành công",
      data: data,
    });
  } catch (error: any) {
    console.error("Error processing stock inbound:", error);
    return NextResponse.json(
      { error: error.message || "Không thể xử lý nhập hàng" },
      { status: 500 },
    );
  }
}

// GET: Lấy lịch sử nhập hàng
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const productId = searchParams.get("productId");
    const limit = parseInt(searchParams.get("limit") || "50");

    let query = supabase
      .from("stock_inbound")
      .select(
        `
        *,
        products(
          id,
          name,
          image_url,
          category
        )
      `,
      )
      .order("created_at", { ascending: false })
      .limit(limit);

    // Lọc theo sản phẩm nếu có
    if (productId) {
      query = query.eq("product_id", productId);
    }

    const { data, error } = await query;

    if (error) throw error;

    // Tính tổng thống kê
    const totalQuantity = data.reduce(
      (sum, item) => sum + item.quantity_added,
      0,
    );
    const totalValue = data.reduce(
      (sum, item) => sum + item.quantity_added * item.cost_price_at_time,
      0,
    );

    return NextResponse.json({
      inbounds: data,
      stats: {
        totalRecords: data.length,
        totalQuantity,
        totalValue,
      },
    });
  } catch (error: any) {
    console.error("Error fetching stock inbound history:", error);
    return NextResponse.json(
      { error: error.message || "Không thể tải lịch sử nhập hàng" },
      { status: 500 },
    );
  }
}
