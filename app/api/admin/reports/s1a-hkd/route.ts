import { NextRequest, NextResponse } from "next/server";
import { isAdminAuthFailure, requireAdminRole } from "@/lib/adminAuth";
import { createServiceRoleSupabaseClient } from "@/lib/supabase-admin";

interface StatusHistoryRow {
  status: string;
  created_at: string;
}

interface OrderItemRow {
  quantity: number;
  products:
    | {
        name: string;
      }
    | Array<{
        name: string;
      }>
    | null;
}

interface CompletedOrderRow {
  id: string;
  total_amount: number;
  created_at: string;
  updated_at: string;
  order_status_history?: StatusHistoryRow[];
  order_items?: OrderItemRow[];
}

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const PAGE_SIZE = 1000;

function getProductName(item: OrderItemRow): string {
  if (Array.isArray(item.products)) {
    return item.products[0]?.name || "Sản phẩm";
  }
  return item.products?.name || "Sản phẩm";
}

function getCompletionDate(order: CompletedOrderRow): string {
  const completedHistory = (order.order_status_history || [])
    .filter((history) => history.status === "completed")
    .sort(
      (first, second) =>
        new Date(first.created_at).getTime() -
        new Date(second.created_at).getTime(),
    )[0];

  return completedHistory?.created_at || order.updated_at || order.created_at;
}

export async function GET(request: NextRequest) {
  try {
    const auth = await requireAdminRole();
    if (isAdminAuthFailure(auth)) return auth.response;

    const { searchParams } = new URL(request.url);
    const from = String(searchParams.get("from") || "");
    const to = String(searchParams.get("to") || "");

    if (!DATE_PATTERN.test(from) || !DATE_PATTERN.test(to)) {
      return NextResponse.json(
        { error: "Khoảng ngày không hợp lệ" },
        { status: 400 },
      );
    }

    const fromDate = new Date(`${from}T00:00:00+07:00`);
    const toDate = new Date(`${to}T23:59:59.999+07:00`);
    if (
      Number.isNaN(fromDate.getTime()) ||
      Number.isNaN(toDate.getTime()) ||
      fromDate.getTime() > toDate.getTime()
    ) {
      return NextResponse.json(
        { error: "Ngày bắt đầu phải trước hoặc bằng ngày kết thúc" },
        { status: 400 },
      );
    }

    const supabase = createServiceRoleSupabaseClient();
    if (!supabase) {
      return NextResponse.json(
        { error: "Thiếu cấu hình SUPABASE_SERVICE_ROLE_KEY" },
        { status: 500 },
      );
    }

    const completedOrders: CompletedOrderRow[] = [];
    let offset = 0;

    while (true) {
      const { data, error } = await supabase
        .from("orders")
        .select(
          `
            id,
            total_amount,
            created_at,
            updated_at,
            order_status_history(
              status,
              created_at
            ),
            order_items(
              quantity,
              products(name)
            )
          `,
        )
        .eq("status", "completed")
        .order("created_at", { ascending: true })
        .range(offset, offset + PAGE_SIZE - 1);

      if (error) throw error;

      const rows = (data || []) as unknown as CompletedOrderRow[];
      completedOrders.push(...rows);
      if (rows.length < PAGE_SIZE) break;
      offset += PAGE_SIZE;
    }

    const entries = completedOrders
      .map((order) => {
        const completedAt = getCompletionDate(order);
        const productSummary = (order.order_items || [])
          .map(
            (item) =>
              `${getProductName(item)}${item.quantity > 1 ? ` x${item.quantity}` : ""}`,
          )
          .join(", ");

        return {
          orderId: order.id,
          orderCode: order.id.slice(0, 8).toUpperCase(),
          completedAt,
          productSummary: productSummary || "Bán hàng hóa, dịch vụ",
          amount: Number(order.total_amount || 0),
        };
      })
      .filter((entry) => {
        const completedTime = new Date(entry.completedAt).getTime();
        return (
          completedTime >= fromDate.getTime() &&
          completedTime <= toDate.getTime()
        );
      })
      .sort((first, second) => {
        const dateDifference =
          new Date(first.completedAt).getTime() -
          new Date(second.completedAt).getTime();
        return dateDifference || first.orderId.localeCompare(second.orderId);
      });

    return NextResponse.json(
      {
        entries,
        summary: {
          orderCount: entries.length,
          totalAmount: entries.reduce(
            (sum, entry) => sum + entry.amount,
            0,
          ),
          from,
          to,
        },
      },
      {
        headers: {
          "Cache-Control": "no-store",
        },
      },
    );
  } catch (error) {
    console.error("Error generating S1a-HKD report data:", error);
    return NextResponse.json(
      { error: "Không thể tạo dữ liệu sổ S1a-HKD" },
      { status: 500 },
    );
  }
}
