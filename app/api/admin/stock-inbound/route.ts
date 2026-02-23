import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { AuditLogger } from "@/lib/auditLogger";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";

function createAdminInventoryClient() {
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;

  if (!serviceRoleKey || !supabaseUrl) {
    return supabase as any;
  }

  return createClient<Database>(supabaseUrl, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  }) as any;
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  return "Đã xảy ra lỗi";
}

type CostingMethod = "weighted_average" | "latest_cost";

type StockInboundHistoryItem = {
  id: string;
  product_id: string;
  quantity_added: number;
  cost_price_at_time: number;
  supplier: string | null;
  notes: string | null;
  created_at: string;
  products?: {
    id: string;
    name: string;
    image_url: string | null;
    category: string;
    cost_price?: number;
  } | null;
};

// POST: Ghi nhận nhập hàng
export async function POST(request: NextRequest) {
  try {
    const authClient = await createServerSupabaseClient();
    const {
      data: { user },
    } = await authClient.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const sb = createAdminInventoryClient();
    const body = await request.json();
    const {
      productId,
      quantityAdded,
      costPriceAtTime,
      supplier,
      notes,
      costingMethod,
    } = body;
    const normalizedQuantity = Number(quantityAdded);
    const normalizedCostPrice = Number(costPriceAtTime);
    const normalizedCostingMethod: CostingMethod =
      costingMethod === "latest_cost" ? "latest_cost" : "weighted_average";

    // Validation
    if (
      !productId ||
      !Number.isFinite(normalizedQuantity) ||
      !Number.isFinite(normalizedCostPrice)
    ) {
      return NextResponse.json(
        { error: "Product ID, số lượng và giá vốn là bắt buộc" },
        { status: 400 },
      );
    }

    if (normalizedQuantity <= 0) {
      return NextResponse.json(
        { error: "Số lượng nhập phải lớn hơn 0" },
        { status: 400 },
      );
    }

    if (normalizedCostPrice < 0) {
      return NextResponse.json(
        { error: "Giá vốn không được âm" },
        { status: 400 },
      );
    }

    // Gọi function xử lý nhập hàng
    const { data, error } = await sb.rpc("process_stock_inbound", {
      p_product_id: productId,
      p_quantity_added: normalizedQuantity,
      p_cost_price_at_time: normalizedCostPrice,
      p_supplier: supplier || null,
      p_notes: notes || null,
    });

    if (error) throw error;

    if (normalizedCostingMethod === "latest_cost") {
      const { error: updateCostError } = await sb
        .from("products")
        .update({ cost_price: normalizedCostPrice })
        .eq("id", productId);

      if (updateCostError) throw updateCostError;
    }

    // Get product info for logging + stock verification
    const { data: product, error: productError } = await sb
      .from("products")
      .select("name, stock_quantity")
      .eq("id", productId)
      .single();

    if (productError) throw productError;

    const rpcResult = (data || {}) as {
      new_stock_quantity?: number | null;
      new_weighted_avg_cost?: number | null;
      [key: string]: unknown;
    };
    const resolvedNewStockQuantity =
      rpcResult.new_stock_quantity ?? product?.stock_quantity ?? null;
    const resolvedNewCostPrice =
      normalizedCostingMethod === "latest_cost"
        ? normalizedCostPrice
        : (rpcResult.new_weighted_avg_cost ?? null);

    if (resolvedNewStockQuantity === null) {
      return NextResponse.json(
        {
          error:
            "Không thể xác nhận tồn kho mới sau khi nhập. Vui lòng kiểm tra cấu hình kho.",
        },
        { status: 500 },
      );
    }

    // Log audit event
    if (product) {
      await AuditLogger.stockInbound(
        productId,
        product.name,
        normalizedQuantity,
        normalizedCostPrice,
        supplier,
      );
    }

    return NextResponse.json({
      success: true,
      message: "Nhập hàng thành công",
      data: {
        ...rpcResult,
        costing_method: normalizedCostingMethod,
        new_cost_price: resolvedNewCostPrice,
        new_stock_quantity: resolvedNewStockQuantity,
      },
    });
  } catch (error: unknown) {
    console.error("Error processing stock inbound:", error);
    return NextResponse.json(
      { error: getErrorMessage(error) || "Không thể xử lý nhập hàng" },
      { status: 500 },
    );
  }
}

// GET: Lấy lịch sử nhập hàng
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
    const productId = searchParams.get("productId");
    const limit = parseInt(searchParams.get("limit") || "50");
    const sb = createAdminInventoryClient();

    let query = sb
      .from("stock_inbound")
      .select(
        `
        *,
        products(
          id,
          name,
          image_url,
          category,
          cost_price
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

    const inbounds: StockInboundHistoryItem[] = (
      Array.isArray(data) ? data : []
    ) as StockInboundHistoryItem[];

    // Tính tổng thống kê
    const totalQuantity = inbounds.reduce(
      (sum: number, item: StockInboundHistoryItem) => sum + item.quantity_added,
      0,
    );
    const totalValue = inbounds.reduce(
      (sum: number, item: StockInboundHistoryItem) =>
        sum + item.quantity_added * item.cost_price_at_time,
      0,
    );
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayRecords = inbounds.filter((item: StockInboundHistoryItem) => {
      const createdAt = new Date(item.created_at);
      return createdAt >= today;
    }).length;

    return NextResponse.json({
      inbounds,
      stats: {
        totalRecords: inbounds.length,
        totalQuantity,
        totalValue,
        todayRecords,
      },
    });
  } catch (error: unknown) {
    console.error("Error fetching stock inbound history:", error);
    return NextResponse.json(
      { error: getErrorMessage(error) || "Không thể tải lịch sử nhập hàng" },
      { status: 500 },
    );
  }
}
