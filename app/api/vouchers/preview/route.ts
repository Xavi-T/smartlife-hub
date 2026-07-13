import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import { previewVoucherDiscount } from "@/lib/loyalty";

function createVoucherClient() {
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

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as {
      voucherCode?: string;
      customerPhone?: string;
      orderAmount?: number;
    };

    const voucherCode = String(body.voucherCode || "")
      .trim()
      .toUpperCase();
    const customerPhone = String(body.customerPhone || "").trim();
    const orderAmount = Math.max(0, Math.round(Number(body.orderAmount || 0)));

    if (!voucherCode) {
      return NextResponse.json(
        { error: "Vui lòng nhập mã voucher" },
        { status: 400 },
      );
    }

    const sb = createVoucherClient() as any;
    const preview = await previewVoucherDiscount({
      sb,
      voucherCode,
      customerPhone,
      orderAmount,
    });

    return NextResponse.json({
      success: true,
      voucher: {
        id: preview.voucher.id,
        code: preview.voucher.voucher_code,
        type: preview.voucher.voucher_type,
        value: preview.voucher.voucher_value,
        minOrderAmount: preview.voucher.min_order_amount,
        expiresAt: preview.voucher.expires_at,
      },
      discountAmount: preview.discountAmount,
    });
  } catch (error: unknown) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Không thể kiểm tra voucher",
      },
      { status: 400 },
    );
  }
}
