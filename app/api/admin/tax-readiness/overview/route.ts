import { NextRequest, NextResponse } from "next/server";
import { isAdminAuthFailure, requireAdminRole } from "@/lib/adminAuth";
import { createServiceRoleSupabaseClient } from "@/lib/supabase-admin";
import type {
  RevenueThresholdStatus,
  TaxReadinessOverview,
} from "@/types/tax-readiness";

interface SettingsRow {
  annual_revenue_threshold: number;
  warning_level_1: number;
  warning_level_2: number;
  warning_level_3: number;
  current_book_code: string;
  notes: string | null;
}

interface CompletedOrderRow {
  id: string;
  total_amount: number;
  created_at: string;
  updated_at: string;
  order_status_history?: Array<{
    status: string;
    created_at: string;
  }>;
}

interface ManualIncomeRow {
  amount: number;
  occurred_at: string;
}

const PAGE_SIZE = 1000;

function isMissingTaxSchema(error: { code?: string; message?: string }) {
  return (
    error.code === "42P01" ||
    error.code === "PGRST205" ||
    error.message?.includes("tax_compliance_settings") ||
    error.message?.includes("financial_transactions")
  );
}

function getCompletionDate(order: CompletedOrderRow) {
  const completedHistory = (order.order_status_history || [])
    .filter((history) => history.status === "completed")
    .sort(
      (first, second) =>
        new Date(first.created_at).getTime() -
        new Date(second.created_at).getTime(),
    )[0];

  return completedHistory?.created_at || order.updated_at || order.created_at;
}

function getMonthInVietnam(value: string) {
  return Number(
    new Intl.DateTimeFormat("en-US", {
      month: "numeric",
      timeZone: "Asia/Ho_Chi_Minh",
    }).format(new Date(value)),
  );
}

function getStatus(
  percentage: number,
  warningLevels: [number, number, number],
): RevenueThresholdStatus {
  if (percentage >= warningLevels[2]) return "exceeded";
  if (percentage >= warningLevels[1]) return "warning";
  if (percentage >= warningLevels[0]) return "attention";
  return "safe";
}

function parseYear(value: string | null) {
  const year = Number(value || new Date().getFullYear());
  if (!Number.isInteger(year) || year < 2000 || year > 2100) return null;
  return year;
}

export async function GET(request: NextRequest) {
  try {
    const auth = await requireAdminRole();
    if (isAdminAuthFailure(auth)) return auth.response;

    const year = parseYear(new URL(request.url).searchParams.get("year"));
    if (!year) {
      return NextResponse.json({ error: "Năm không hợp lệ" }, { status: 400 });
    }

    const supabase = createServiceRoleSupabaseClient();
    if (!supabase) {
      return NextResponse.json(
        { error: "Thiếu cấu hình SUPABASE_SERVICE_ROLE_KEY" },
        { status: 500 },
      );
    }

    const { data: settingsData, error: settingsError } = await supabase
      .from("tax_compliance_settings")
      .select(
        "annual_revenue_threshold, warning_level_1, warning_level_2, warning_level_3, current_book_code, notes",
      )
      .eq("id", 1)
      .single();

    if (settingsError) {
      if (isMissingTaxSchema(settingsError)) {
        return NextResponse.json(
          {
            error:
              "Chưa cài đặt dữ liệu thuế. Hãy chạy database/tax_readiness_schema.sql trên Supabase.",
          },
          { status: 503 },
        );
      }
      throw settingsError;
    }

    const settings = settingsData as SettingsRow;
    const completedOrders: CompletedOrderRow[] = [];
    let offset = 0;

    while (true) {
      const { data, error } = await supabase
        .from("orders")
        .select(
          "id, total_amount, created_at, updated_at, order_status_history(status, created_at)",
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

    const from = `${year}-01-01`;
    const to = `${year}-12-31`;
    const { data: manualIncomeData, error: manualIncomeError } = await supabase
      .from("financial_transactions")
      .select("amount, occurred_at")
      .eq("transaction_type", "income")
      .eq("affects_tax_revenue", true)
      .is("order_id", null)
      .gte("occurred_at", from)
      .lte("occurred_at", to);

    if (manualIncomeError) throw manualIncomeError;

    const monthlyRevenue = Array.from({ length: 12 }, (_, index) => ({
      month: index + 1,
      amount: 0,
      orderCount: 0,
    }));

    let completedOrderRevenue = 0;
    let completedOrderCount = 0;
    for (const order of completedOrders) {
      const completedAt = getCompletionDate(order);
      const completedYear = Number(
        new Intl.DateTimeFormat("en-US", {
          year: "numeric",
          timeZone: "Asia/Ho_Chi_Minh",
        }).format(new Date(completedAt)),
      );
      if (completedYear !== year) continue;

      const amount = Number(order.total_amount || 0);
      const month = getMonthInVietnam(completedAt);
      completedOrderRevenue += amount;
      completedOrderCount += 1;
      monthlyRevenue[month - 1].amount += amount;
      monthlyRevenue[month - 1].orderCount += 1;
    }

    const manualIncome = (manualIncomeData || []) as ManualIncomeRow[];
    const manualTaxableIncome = manualIncome.reduce((sum, transaction) => {
      const amount = Number(transaction.amount || 0);
      const month = Number(transaction.occurred_at.slice(5, 7));
      if (month >= 1 && month <= 12) {
        monthlyRevenue[month - 1].amount += amount;
      }
      return sum + amount;
    }, 0);

    const threshold = Number(settings.annual_revenue_threshold);
    const total = completedOrderRevenue + manualTaxableIncome;
    const percentage = threshold > 0 ? (total / threshold) * 100 : 0;
    const warningLevels: [number, number, number] = [
      settings.warning_level_1,
      settings.warning_level_2,
      settings.warning_level_3,
    ];

    const response: TaxReadinessOverview = {
      year,
      settings: {
        annualRevenueThreshold: threshold,
        warningLevels,
        currentBookCode: settings.current_book_code,
        notes: settings.notes || "",
      },
      revenue: {
        completedOrders: completedOrderRevenue,
        completedOrderCount,
        manualTaxableIncome,
        total,
        remaining: Math.max(0, threshold - total),
        percentage,
        status: getStatus(percentage, warningLevels),
      },
      monthlyRevenue,
    };

    return NextResponse.json(response, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    console.error("Error loading tax readiness overview:", error);
    return NextResponse.json(
      { error: "Không thể tải tổng quan thuế" },
      { status: 500 },
    );
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const auth = await requireAdminRole();
    if (isAdminAuthFailure(auth)) return auth.response;

    const body = await request.json();
    const threshold = Number(body.annualRevenueThreshold);
    const warningLevels = Array.isArray(body.warningLevels)
      ? body.warningLevels.map(Number)
      : [];

    if (!Number.isFinite(threshold) || threshold <= 0) {
      return NextResponse.json(
        { error: "Ngưỡng doanh thu phải lớn hơn 0" },
        { status: 400 },
      );
    }
    if (
      warningLevels.length !== 3 ||
      !warningLevels.every(
        (level: number) =>
          Number.isInteger(level) && level >= 1 && level <= 100,
      ) ||
      !(warningLevels[0] < warningLevels[1] &&
        warningLevels[1] < warningLevels[2])
    ) {
      return NextResponse.json(
        { error: "Ba mốc cảnh báo phải tăng dần và nằm trong khoảng 1–100%" },
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

    const { error } = await supabase
      .from("tax_compliance_settings")
      .update({
        annual_revenue_threshold: threshold,
        warning_level_1: warningLevels[0],
        warning_level_2: warningLevels[1],
        warning_level_3: warningLevels[2],
        current_book_code: String(body.currentBookCode || "S1a-HKD").trim(),
        notes: String(body.notes || "").trim() || null,
        updated_by: auth.user.email || auth.user.id,
      })
      .eq("id", 1);

    if (error) {
      if (isMissingTaxSchema(error)) {
        return NextResponse.json(
          {
            error:
              "Chưa cài đặt dữ liệu thuế. Hãy chạy database/tax_readiness_schema.sql trên Supabase.",
          },
          { status: 503 },
        );
      }
      throw error;
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error updating tax readiness settings:", error);
    return NextResponse.json(
      { error: "Không thể cập nhật cấu hình thuế" },
      { status: 500 },
    );
  }
}
