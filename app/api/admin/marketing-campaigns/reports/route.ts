import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";

function createAdminReportClient() {
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;

  if (!serviceRoleKey || !supabaseUrl) return supabase;

  return createClient<Database>(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

function normalizePhone(value: unknown): string {
  return String(value || "").replace(/\D/g, "");
}

function toNumber(value: unknown): number {
  const numeric = Number(value || 0);
  return Number.isFinite(numeric) ? numeric : 0;
}

interface SegmentReportRow {
  segmentKey: string;
  segmentLabel: string;
  customerCount: number;
  earnedPoints: number;
  redeemedPoints: number;
  vouchersIssued: number;
  vouchersUsed: number;
  voucherDiscountAmount: number;
  voucherRevenue: number;
}

function emptyRow(segmentKey: string, segmentLabel?: string): SegmentReportRow {
  return {
    segmentKey,
    segmentLabel: segmentLabel || segmentKey,
    customerCount: 0,
    earnedPoints: 0,
    redeemedPoints: 0,
    vouchersIssued: 0,
    vouchersUsed: 0,
    voucherDiscountAmount: 0,
    voucherRevenue: 0,
  };
}

export async function GET() {
  try {
    const authClient = await createServerSupabaseClient();
    const {
      data: { user },
    } = await authClient.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const sb = createAdminReportClient() as any;

    const [
      segmentsResult,
      customersResult,
      transactionsResult,
      vouchersResult,
    ] = await Promise.all([
      sb.from("customer_segment_settings").select("segment_key, segment_label"),
      sb
        .from("priority_customers")
        .select("customer_phone, customer_segment")
        .eq("is_active", true),
      sb
        .from("customer_point_transactions")
        .select("customer_phone, direction, points"),
      sb
        .from("customer_vouchers")
        .select(
          "customer_phone, status, used_order_id, used_discount_amount, created_at",
        ),
    ]);

    if (segmentsResult.error) throw segmentsResult.error;
    if (customersResult.error) throw customersResult.error;
    if (transactionsResult.error) throw transactionsResult.error;
    if (vouchersResult.error) throw vouchersResult.error;

    const segmentLabels = new Map<string, string>();
    for (const segment of segmentsResult.data || []) {
      segmentLabels.set(segment.segment_key, segment.segment_label);
    }

    const phoneToSegment = new Map<string, string>();
    const rows = new Map<string, SegmentReportRow>();
    const getRow = (segmentKey: string) => {
      if (!rows.has(segmentKey)) {
        rows.set(
          segmentKey,
          emptyRow(segmentKey, segmentLabels.get(segmentKey)),
        );
      }
      return rows.get(segmentKey)!;
    };

    for (const customer of customersResult.data || []) {
      const phone = normalizePhone(customer.customer_phone);
      const segmentKey = customer.customer_segment || "unclassified";
      if (phone) phoneToSegment.set(phone, segmentKey);
      getRow(segmentKey).customerCount += 1;
    }

    const getSegmentForPhone = (phone: unknown) =>
      phoneToSegment.get(normalizePhone(phone)) || "unclassified";

    for (const tx of transactionsResult.data || []) {
      const row = getRow(getSegmentForPhone(tx.customer_phone));
      if (tx.direction === "earn") row.earnedPoints += toNumber(tx.points);
      if (tx.direction === "redeem") row.redeemedPoints += toNumber(tx.points);
    }

    const usedOrderIds = Array.from(
      new Set(
        (vouchersResult.data || [])
          .filter(
            (voucher: any) =>
              voucher.status === "used" && voucher.used_order_id,
          )
          .map((voucher: any) => voucher.used_order_id),
      ),
    );

    const orderRevenueById = new Map<string, number>();
    if (usedOrderIds.length > 0) {
      const { data: orders, error: ordersError } = await sb
        .from("orders")
        .select("id, total_amount")
        .in("id", usedOrderIds);
      if (ordersError) throw ordersError;
      for (const order of orders || []) {
        orderRevenueById.set(order.id, toNumber(order.total_amount));
      }
    }

    for (const voucher of vouchersResult.data || []) {
      const row = getRow(getSegmentForPhone(voucher.customer_phone));
      row.vouchersIssued += 1;
      if (voucher.status === "used") {
        row.vouchersUsed += 1;
        row.voucherDiscountAmount += toNumber(voucher.used_discount_amount);
        if (voucher.used_order_id) {
          row.voucherRevenue +=
            orderRevenueById.get(voucher.used_order_id) || 0;
        }
      }
    }

    const reports = Array.from(rows.values()).sort((a, b) =>
      a.segmentLabel.localeCompare(b.segmentLabel, "vi"),
    );

    const totals = reports.reduce(
      (summary, row) => ({
        customerCount: summary.customerCount + row.customerCount,
        earnedPoints: summary.earnedPoints + row.earnedPoints,
        redeemedPoints: summary.redeemedPoints + row.redeemedPoints,
        vouchersIssued: summary.vouchersIssued + row.vouchersIssued,
        vouchersUsed: summary.vouchersUsed + row.vouchersUsed,
        voucherDiscountAmount:
          summary.voucherDiscountAmount + row.voucherDiscountAmount,
        voucherRevenue: summary.voucherRevenue + row.voucherRevenue,
      }),
      {
        customerCount: 0,
        earnedPoints: 0,
        redeemedPoints: 0,
        vouchersIssued: 0,
        vouchersUsed: 0,
        voucherDiscountAmount: 0,
        voucherRevenue: 0,
      },
    );

    return NextResponse.json({ reports, totals });
  } catch (error: unknown) {
    console.error("Error loading marketing reports:", error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Không thể tải báo cáo",
      },
      { status: 500 },
    );
  }
}
