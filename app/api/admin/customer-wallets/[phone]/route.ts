import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";

function createAdminWalletClient() {
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

function normalizePhone(value: string): string {
  return String(value || "").replace(/\D/g, "");
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ phone: string }> },
) {
  try {
    const authClient = await createServerSupabaseClient();
    const {
      data: { user },
    } = await authClient.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { phone } = await params;
    const normalizedPhone = normalizePhone(phone);
    if (!normalizedPhone) {
      return NextResponse.json(
        { error: "Số điện thoại không hợp lệ" },
        { status: 400 },
      );
    }

    const adminClient = createAdminWalletClient() as any;

    const { data: wallet } = await adminClient
      .from("customer_point_wallets")
      .select("*")
      .eq("customer_phone", normalizedPhone)
      .maybeSingle();

    const { data: transactions, error: txError } = await adminClient
      .from("customer_point_transactions")
      .select("*")
      .eq("customer_phone", normalizedPhone)
      .order("created_at", { ascending: false })
      .limit(50);

    if (txError) throw txError;

    const { data: vouchers, error: voucherError } = await adminClient
      .from("customer_vouchers")
      .select("*")
      .eq("customer_phone", normalizedPhone)
      .order("created_at", { ascending: false });

    if (voucherError) throw voucherError;

    const nowIso = new Date().toISOString();
    const { data: redeemCampaigns, error: campaignError } = await adminClient
      .from("marketing_campaigns")
      .select("*")
      .eq("campaign_type", "points_redeem_voucher")
      .eq("is_active", true)
      .order("priority", { ascending: true });

    if (campaignError) throw campaignError;

    const activeRedeemCampaigns = (
      Array.isArray(redeemCampaigns) ? redeemCampaigns : []
    ).filter((campaign: any) => {
      if (campaign.is_unlimited_time) return true;
      if (!campaign.start_at || !campaign.end_at) return false;
      return campaign.start_at <= nowIso && campaign.end_at >= nowIso;
    });

    return NextResponse.json({
      wallet: wallet || {
        customer_phone: normalizedPhone,
        total_points: 0,
        lifetime_earned_points: 0,
        lifetime_redeemed_points: 0,
        last_transaction_at: null,
      },
      transactions: Array.isArray(transactions) ? transactions : [],
      vouchers: Array.isArray(vouchers) ? vouchers : [],
      redeemCampaigns: activeRedeemCampaigns,
    });
  } catch (error: unknown) {
    console.error("Error loading customer wallet:", error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Không thể tải ví điểm",
      },
      { status: 500 },
    );
  }
}
