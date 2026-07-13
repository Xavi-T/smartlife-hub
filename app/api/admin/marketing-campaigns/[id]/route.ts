import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";

type CampaignType = "points_earn" | "points_redeem_voucher" | "gift";

function createAdminMarketingClient() {
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

function normalizeCode(value: unknown): string | null {
  const code = String(value || "")
    .trim()
    .toUpperCase()
    .replace(/\s+/g, "_");
  return code ? code : null;
}

function normalizeCampaignType(value: unknown): CampaignType {
  if (value === "points_redeem_voucher") return "points_redeem_voucher";
  if (value === "gift") return "gift";
  return "points_earn";
}

function toSafeNumber(value: unknown): number {
  const numeric = Number(value || 0);
  if (!Number.isFinite(numeric)) return 0;
  return numeric;
}

function buildCampaignConfig(
  payload: Record<string, unknown>,
): Record<string, unknown> {
  return {
    pointsEarnRatePer1000: Math.max(
      0,
      toSafeNumber(payload.pointsEarnRatePer1000),
    ),
    pointsCost: Math.max(0, Math.round(toSafeNumber(payload.pointsCost))),
    voucherType:
      payload.voucherType === "amount"
        ? "amount"
        : payload.voucherType === "percent"
          ? "percent"
          : null,
    voucherValue: Math.max(0, toSafeNumber(payload.voucherValue)),
    maxDiscountAmount: Math.max(0, toSafeNumber(payload.maxDiscountAmount)),
    minOrderAmount: Math.max(0, toSafeNumber(payload.minOrderAmount)),
    expiresInDays: Math.max(0, Math.round(toSafeNumber(payload.expiresInDays))),
    giftName: String(payload.giftName || "").trim() || null,
    giftSku: String(payload.giftSku || "").trim() || null,
    giftQuantity: Math.max(0, Math.round(toSafeNumber(payload.giftQuantity))),
    notes: String(payload.notes || "").trim() || null,
  };
}

function validateCampaignInput(input: {
  name: string;
  campaignType: CampaignType;
  isUnlimitedTime: boolean;
  startAt: string | null;
  endAt: string | null;
  config: Record<string, unknown>;
}): string | null {
  if (!input.name) {
    return "Tên chiến dịch là bắt buộc";
  }

  if (!input.isUnlimitedTime) {
    if (!input.startAt || !input.endAt) {
      return "Chiến dịch có thời hạn cần nhập ngày bắt đầu và kết thúc";
    }
    if (new Date(input.startAt).getTime() > new Date(input.endAt).getTime()) {
      return "Ngày kết thúc phải lớn hơn hoặc bằng ngày bắt đầu";
    }
  }

  if (input.campaignType === "points_earn") {
    if (toSafeNumber(input.config.pointsEarnRatePer1000) <= 0) {
      return "Chiến dịch tích điểm cần cấu hình điểm nhận trên mỗi 1.000đ";
    }
  }

  if (input.campaignType === "points_redeem_voucher") {
    if (toSafeNumber(input.config.pointsCost) <= 0) {
      return "Chiến dịch đổi điểm cần cấu hình số điểm đổi";
    }
    if (toSafeNumber(input.config.voucherValue) <= 0) {
      return "Chiến dịch đổi điểm cần cấu hình giá trị voucher";
    }
  }

  if (input.campaignType === "gift") {
    if (!String(input.config.giftName || "").trim()) {
      return "Chiến dịch tặng quà cần nhập tên quà tặng";
    }
    if (toSafeNumber(input.config.giftQuantity) <= 0) {
      return "Chiến dịch tặng quà cần nhập số lượng quà";
    }
  }

  return null;
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const authClient = await createServerSupabaseClient();
    const {
      data: { user },
    } = await authClient.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const body = (await request.json()) as Record<string, unknown>;
    const name = String(body.name || "").trim();
    const campaignType = normalizeCampaignType(body.campaignType);
    const isUnlimitedTime = body.isUnlimitedTime === true;
    const startAt = isUnlimitedTime
      ? null
      : String(body.startAt || "").trim() || null;
    const endAt = isUnlimitedTime
      ? null
      : String(body.endAt || "").trim() || null;
    const config = buildCampaignConfig(body);

    const validationError = validateCampaignInput({
      name,
      campaignType,
      isUnlimitedTime,
      startAt,
      endAt,
      config,
    });

    if (validationError) {
      return NextResponse.json({ error: validationError }, { status: 400 });
    }

    const adminClient = createAdminMarketingClient() as any;
    const { data, error } = await adminClient
      .from("marketing_campaigns")
      .update({
        campaign_name: name,
        campaign_code: normalizeCode(body.code),
        campaign_type: campaignType,
        description: String(body.description || "").trim() || null,
        is_active: body.isActive !== false,
        is_unlimited_time: isUnlimitedTime,
        start_at: startAt,
        end_at: endAt,
        priority: Math.max(0, Math.round(toSafeNumber(body.priority || 100))),
        config,
        updated_by: user.email || user.id,
      })
      .eq("id", id)
      .select("*")
      .single();

    if (error) throw error;

    return NextResponse.json({
      success: true,
      campaign: data,
      message: "Đã cập nhật chiến dịch marketing",
    });
  } catch (error: unknown) {
    console.error("Error updating marketing campaign:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Không thể cập nhật chiến dịch marketing",
      },
      { status: 500 },
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const authClient = await createServerSupabaseClient();
    const {
      data: { user },
    } = await authClient.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const adminClient = createAdminMarketingClient() as any;

    const { error } = await adminClient
      .from("marketing_campaigns")
      .delete()
      .eq("id", id);

    if (error) throw error;

    return NextResponse.json({
      success: true,
      message: "Đã xóa chiến dịch marketing",
    });
  } catch (error: unknown) {
    console.error("Error deleting marketing campaign:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Không thể xóa chiến dịch marketing",
      },
      { status: 500 },
    );
  }
}
