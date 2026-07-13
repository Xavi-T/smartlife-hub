import type { Database } from "@/types/database";
import { createClient } from "@supabase/supabase-js";

export type SupabaseServiceClient = ReturnType<typeof createClient<Database>>;

type CampaignType = "points_earn" | "points_redeem_voucher" | "gift";

type MarketingCampaignRow = {
  id: string;
  campaign_name: string;
  campaign_code: string | null;
  campaign_type: CampaignType;
  is_active: boolean;
  is_unlimited_time: boolean;
  start_at: string | null;
  end_at: string | null;
  priority: number;
  config: Record<string, unknown> | null;
};

type PointWalletRow = {
  customer_phone: string;
  total_points: number;
  lifetime_earned_points: number;
  lifetime_redeemed_points: number;
};

type CustomerVoucherRow = {
  id: string;
  customer_phone: string | null;
  campaign_id: string | null;
  voucher_code: string;
  voucher_type: "percent" | "amount";
  voucher_value: number;
  max_discount_amount: number;
  min_order_amount: number;
  status: "active" | "used" | "expired" | "cancelled";
  expires_at: string | null;
};

function normalizePhone(phone: string): string {
  return String(phone || "").replace(/\D/g, "");
}

function toNumber(value: unknown): number {
  const numeric = Number(value || 0);
  if (!Number.isFinite(numeric)) return 0;
  return numeric;
}

function randomVoucherCode(prefix: string): string {
  const token = Math.random().toString(36).slice(2, 8).toUpperCase();
  const timestamp = Date.now().toString().slice(-6);
  return `${prefix}_${timestamp}${token}`;
}

async function getActiveCampaign(
  sb: SupabaseServiceClient,
  campaignType: CampaignType,
  nowIso: string,
): Promise<MarketingCampaignRow | null> {
  const adminClient = sb as unknown as any;
  const { data, error } = await adminClient
    .from("marketing_campaigns")
    .select("*")
    .eq("campaign_type", campaignType)
    .eq("is_active", true)
    .order("priority", { ascending: true })
    .order("updated_at", { ascending: false });

  if (error) {
    throw new Error(error.message || "Không thể tải chiến dịch marketing");
  }

  const campaigns = (Array.isArray(data) ? data : []) as MarketingCampaignRow[];
  return (
    campaigns.find((campaign) => {
      if (campaign.is_unlimited_time) return true;
      if (!campaign.start_at || !campaign.end_at) return false;
      return campaign.start_at <= nowIso && campaign.end_at >= nowIso;
    }) || null
  );
}

async function getOrCreateWallet(
  sb: SupabaseServiceClient,
  customerPhone: string,
): Promise<PointWalletRow> {
  const normalizedPhone = normalizePhone(customerPhone);
  const adminClient = sb as unknown as any;

  const { data: existingWallet } = await adminClient
    .from("customer_point_wallets")
    .select("*")
    .eq("customer_phone", normalizedPhone)
    .maybeSingle();

  if (existingWallet) {
    return existingWallet as PointWalletRow;
  }

  const { data: createdWallet, error: createWalletError } = await adminClient
    .from("customer_point_wallets")
    .insert({
      customer_phone: normalizedPhone,
      total_points: 0,
      lifetime_earned_points: 0,
      lifetime_redeemed_points: 0,
    })
    .select("*")
    .single();

  if (createWalletError || !createdWallet) {
    throw new Error(
      createWalletError?.message || "Không thể khởi tạo ví điểm khách hàng",
    );
  }

  return createdWallet as PointWalletRow;
}

export async function awardPointsForOrder(params: {
  sb: SupabaseServiceClient;
  orderId: string;
  customerPhone: string;
  totalAmount: number;
  createdBy?: string | null;
}): Promise<{ earnedPoints: number; currentPointBalance: number }> {
  const { sb, orderId, customerPhone, totalAmount, createdBy } = params;
  const normalizedPhone = normalizePhone(customerPhone);
  if (!normalizedPhone || totalAmount <= 0) {
    return { earnedPoints: 0, currentPointBalance: 0 };
  }

  const nowIso = new Date().toISOString();
  const campaign = await getActiveCampaign(sb, "points_earn", nowIso);
  if (!campaign) {
    const wallet = await getOrCreateWallet(sb, normalizedPhone);
    return {
      earnedPoints: 0,
      currentPointBalance: toNumber(wallet.total_points),
    };
  }

  const rate = toNumber(campaign.config?.pointsEarnRatePer1000);
  const earnedPoints = Math.max(0, Math.floor((totalAmount / 1000) * rate));

  const adminClient = sb as unknown as any;
  const { data: existingTx } = await adminClient
    .from("customer_point_transactions")
    .select("id")
    .eq("direction", "earn")
    .eq("reference_type", "order")
    .eq("reference_id", orderId)
    .maybeSingle();

  const wallet = await getOrCreateWallet(sb, normalizedPhone);
  if (existingTx || earnedPoints <= 0) {
    return {
      earnedPoints: 0,
      currentPointBalance: toNumber(wallet.total_points),
    };
  }

  const nextTotal = toNumber(wallet.total_points) + earnedPoints;
  const nextLifetimeEarned =
    toNumber(wallet.lifetime_earned_points) + earnedPoints;

  const { error: walletError } = await adminClient
    .from("customer_point_wallets")
    .update({
      total_points: nextTotal,
      lifetime_earned_points: nextLifetimeEarned,
      last_transaction_at: nowIso,
    })
    .eq("customer_phone", normalizedPhone);

  if (walletError) {
    throw new Error(walletError.message || "Không thể cộng điểm khách hàng");
  }

  const { error: txError } = await adminClient
    .from("customer_point_transactions")
    .insert({
      customer_phone: normalizedPhone,
      campaign_id: campaign.id,
      direction: "earn",
      points: earnedPoints,
      reference_type: "order",
      reference_id: orderId,
      note: `Cộng điểm từ đơn hàng #${orderId.slice(0, 8).toUpperCase()}`,
      created_by: createdBy || null,
    });

  if (txError) {
    throw new Error(txError.message || "Không thể ghi lịch sử cộng điểm");
  }

  return {
    earnedPoints,
    currentPointBalance: nextTotal,
  };
}

export async function reversePointsForCancelledOrder(params: {
  sb: SupabaseServiceClient;
  orderId: string;
  customerPhone: string;
  createdBy?: string | null;
}): Promise<{ deductedPoints: number; currentPointBalance: number }> {
  const { sb, orderId, customerPhone, createdBy } = params;
  const normalizedPhone = normalizePhone(customerPhone);
  if (!normalizedPhone) {
    return { deductedPoints: 0, currentPointBalance: 0 };
  }

  const adminClient = sb as unknown as any;
  const { data: earnTx } = await adminClient
    .from("customer_point_transactions")
    .select("points")
    .eq("direction", "earn")
    .eq("reference_type", "order")
    .eq("reference_id", orderId)
    .maybeSingle();

  const earnedPoints = Math.max(0, toNumber(earnTx?.points));
  const wallet = await getOrCreateWallet(sb, normalizedPhone);
  if (earnedPoints <= 0) {
    return {
      deductedPoints: 0,
      currentPointBalance: toNumber(wallet.total_points),
    };
  }

  const { data: existingReverse } = await adminClient
    .from("customer_point_transactions")
    .select("id")
    .eq("direction", "adjust")
    .eq("reference_type", "order_cancel")
    .eq("reference_id", orderId)
    .maybeSingle();

  if (existingReverse) {
    return {
      deductedPoints: 0,
      currentPointBalance: toNumber(wallet.total_points),
    };
  }

  const nextTotal = Math.max(0, toNumber(wallet.total_points) - earnedPoints);

  const { error: walletError } = await adminClient
    .from("customer_point_wallets")
    .update({
      total_points: nextTotal,
      last_transaction_at: new Date().toISOString(),
    })
    .eq("customer_phone", normalizedPhone);

  if (walletError) {
    throw new Error(walletError.message || "Không thể trừ điểm do hủy đơn");
  }

  const { error: txError } = await adminClient
    .from("customer_point_transactions")
    .insert({
      customer_phone: normalizedPhone,
      direction: "adjust",
      points: earnedPoints,
      reference_type: "order_cancel",
      reference_id: orderId,
      note: `Trừ điểm do hủy đơn #${orderId.slice(0, 8).toUpperCase()}`,
      created_by: createdBy || null,
    });

  if (txError) {
    throw new Error(txError.message || "Không thể ghi lịch sử trừ điểm");
  }

  return {
    deductedPoints: earnedPoints,
    currentPointBalance: nextTotal,
  };
}

export async function redeemPointsToVoucher(params: {
  sb: SupabaseServiceClient;
  customerPhone: string;
  campaignId: string;
  requestedBy?: string | null;
}): Promise<{ voucherCode: string; pointsSpent: number }> {
  const { sb, customerPhone, campaignId, requestedBy } = params;
  const normalizedPhone = normalizePhone(customerPhone);
  if (!normalizedPhone) {
    throw new Error("Số điện thoại khách hàng không hợp lệ");
  }

  const adminClient = sb as unknown as any;
  const { data: campaign, error: campaignError } = await adminClient
    .from("marketing_campaigns")
    .select("*")
    .eq("id", campaignId)
    .eq("campaign_type", "points_redeem_voucher")
    .eq("is_active", true)
    .single();

  if (campaignError || !campaign) {
    throw new Error("Chiến dịch đổi điểm không tồn tại hoặc đã tắt");
  }

  const config = (campaign.config || {}) as Record<string, unknown>;
  const pointsCost = Math.max(1, Math.round(toNumber(config.pointsCost)));
  const voucherType = config.voucherType === "percent" ? "percent" : "amount";
  const voucherValue = Math.max(1, toNumber(config.voucherValue));
  const maxDiscountAmount = Math.max(0, toNumber(config.maxDiscountAmount));
  const expiresInDays = Math.max(0, Math.round(toNumber(config.expiresInDays)));
  const minOrderAmount = Math.max(0, toNumber(config.minOrderAmount));

  const wallet = await getOrCreateWallet(sb, normalizedPhone);
  if (toNumber(wallet.total_points) < pointsCost) {
    throw new Error("Điểm hiện tại không đủ để đổi voucher");
  }

  const voucherCode = randomVoucherCode(campaign.campaign_code || "VC");
  const expiresAt =
    expiresInDays > 0
      ? new Date(Date.now() + expiresInDays * 86400000).toISOString()
      : null;

  const nextTotal = toNumber(wallet.total_points) - pointsCost;
  const nextLifetimeRedeemed =
    toNumber(wallet.lifetime_redeemed_points) + pointsCost;

  const { error: walletError } = await adminClient
    .from("customer_point_wallets")
    .update({
      total_points: nextTotal,
      lifetime_redeemed_points: nextLifetimeRedeemed,
      last_transaction_at: new Date().toISOString(),
    })
    .eq("customer_phone", normalizedPhone);

  if (walletError) {
    throw new Error(walletError.message || "Không thể cập nhật ví điểm");
  }

  const { error: txError } = await adminClient
    .from("customer_point_transactions")
    .insert({
      customer_phone: normalizedPhone,
      campaign_id: campaign.id,
      direction: "redeem",
      points: pointsCost,
      reference_type: "voucher",
      reference_id: voucherCode,
      note: `Đổi ${pointsCost} điểm lấy voucher ${voucherCode}`,
      created_by: requestedBy || null,
    });

  if (txError) {
    throw new Error(txError.message || "Không thể ghi lịch sử đổi điểm");
  }

  const { error: voucherError } = await adminClient
    .from("customer_vouchers")
    .insert({
      customer_phone: normalizedPhone,
      campaign_id: campaign.id,
      voucher_code: voucherCode,
      voucher_type: voucherType,
      voucher_value: voucherValue,
      max_discount_amount: maxDiscountAmount,
      min_order_amount: minOrderAmount,
      status: "active",
      expires_at: expiresAt,
      metadata: {
        pointsCost,
        campaignName: campaign.campaign_name,
      },
      created_by: requestedBy || null,
    });

  if (voucherError) {
    throw new Error(voucherError.message || "Không thể tạo voucher");
  }

  return { voucherCode, pointsSpent: pointsCost };
}

export async function previewVoucherDiscount(params: {
  sb: SupabaseServiceClient;
  voucherCode: string;
  customerPhone?: string | null;
  orderAmount: number;
}): Promise<{
  voucher: CustomerVoucherRow;
  discountAmount: number;
}> {
  const { sb, voucherCode, customerPhone, orderAmount } = params;
  const adminClient = sb as unknown as any;

  const normalizedCode = String(voucherCode || "")
    .trim()
    .toUpperCase();
  if (!normalizedCode) {
    throw new Error("Vui lòng nhập mã voucher");
  }

  const { data: voucher, error } = await adminClient
    .from("customer_vouchers")
    .select("*")
    .eq("voucher_code", normalizedCode)
    .single();

  if (error || !voucher) {
    throw new Error("Voucher không tồn tại");
  }

  const voucherRow = voucher as CustomerVoucherRow;

  if (voucherRow.status !== "active") {
    throw new Error("Voucher không còn hiệu lực");
  }

  if (
    voucherRow.expires_at &&
    new Date(voucherRow.expires_at).getTime() < Date.now()
  ) {
    throw new Error("Voucher đã hết hạn");
  }

  const normalizedPhone = normalizePhone(String(customerPhone || ""));
  if (
    voucherRow.customer_phone &&
    normalizePhone(voucherRow.customer_phone) !== normalizedPhone
  ) {
    throw new Error("Voucher không áp dụng cho số điện thoại này");
  }

  if (orderAmount < toNumber(voucherRow.min_order_amount)) {
    throw new Error(
      `Đơn hàng cần tối thiểu ${toNumber(voucherRow.min_order_amount).toLocaleString("vi-VN")}đ để dùng voucher`,
    );
  }

  const rawDiscount =
    voucherRow.voucher_type === "percent"
      ? Math.round((orderAmount * toNumber(voucherRow.voucher_value)) / 100)
      : Math.round(toNumber(voucherRow.voucher_value));
  const cap = Math.round(toNumber(voucherRow.max_discount_amount));
  const discountAmount = Math.min(
    orderAmount,
    cap > 0 ? Math.min(rawDiscount, cap) : rawDiscount,
  );

  if (discountAmount <= 0) {
    throw new Error("Voucher không tạo được mức giảm hợp lệ");
  }

  return {
    voucher: voucherRow,
    discountAmount,
  };
}

export async function consumeVoucherForOrder(params: {
  sb: SupabaseServiceClient;
  voucherId: string;
  orderId: string;
  discountAmount: number;
}): Promise<void> {
  const { sb, voucherId, orderId, discountAmount } = params;
  const adminClient = sb as unknown as any;

  const { error } = await adminClient
    .from("customer_vouchers")
    .update({
      status: "used",
      used_order_id: orderId,
      used_at: new Date().toISOString(),
      used_discount_amount: Math.max(0, Math.round(discountAmount)),
    })
    .eq("id", voucherId)
    .eq("status", "active");

  if (error) {
    throw new Error(error.message || "Không thể cập nhật voucher đã sử dụng");
  }
}
