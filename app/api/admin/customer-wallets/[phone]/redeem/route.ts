import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import { redeemPointsToVoucher } from "@/lib/loyalty";

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

export async function POST(
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
    const body = (await request.json()) as { campaignId?: string };
    const campaignId = String(body.campaignId || "").trim();

    if (!normalizedPhone || !campaignId) {
      return NextResponse.json(
        { error: "Số điện thoại và chiến dịch đổi điểm là bắt buộc" },
        { status: 400 },
      );
    }

    const sb = createAdminWalletClient() as any;
    const result = await redeemPointsToVoucher({
      sb,
      customerPhone: normalizedPhone,
      campaignId,
      requestedBy: user.email || user.id,
    });

    return NextResponse.json({
      success: true,
      ...result,
      message: `Đã đổi điểm thành voucher ${result.voucherCode}`,
    });
  } catch (error: unknown) {
    console.error("Error redeeming points:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Không thể đổi điểm lấy voucher",
      },
      { status: 400 },
    );
  }
}
