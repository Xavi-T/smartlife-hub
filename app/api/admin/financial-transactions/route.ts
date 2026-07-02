import { NextRequest, NextResponse } from "next/server";
import { isAdminAuthFailure, requireAdminRole } from "@/lib/adminAuth";
import { createServiceRoleSupabaseClient } from "@/lib/supabase-admin";

type TransactionType = "income" | "expense";
type PaymentChannel = "cash" | "bank";

interface TransactionBody {
  id?: string;
  transactionType?: TransactionType;
  paymentChannel?: PaymentChannel;
  occurredAt?: string;
  documentNumber?: string;
  category?: string;
  description?: string;
  amount?: number;
  counterparty?: string;
  affectsTaxRevenue?: boolean;
  notes?: string;
}

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

function isMissingSchema(error: { code?: string; message?: string }) {
  return (
    error.code === "42P01" ||
    error.code === "PGRST205" ||
    error.message?.includes("financial_transactions")
  );
}

function schemaErrorResponse() {
  return NextResponse.json(
    {
      error:
        "Chưa cài đặt dữ liệu thu–chi. Hãy chạy database/tax_readiness_schema.sql trên Supabase.",
    },
    { status: 503 },
  );
}

function validateBody(body: TransactionBody) {
  const transactionType = body.transactionType;
  const paymentChannel = body.paymentChannel;
  const occurredAt = String(body.occurredAt || "");
  const category = String(body.category || "").trim();
  const description = String(body.description || "").trim();
  const amount = Number(body.amount);

  if (!["income", "expense"].includes(String(transactionType))) {
    return { error: "Loại giao dịch không hợp lệ" };
  }
  if (!["cash", "bank"].includes(String(paymentChannel))) {
    return { error: "Kênh thanh toán không hợp lệ" };
  }
  if (!DATE_PATTERN.test(occurredAt)) {
    return { error: "Ngày giao dịch không hợp lệ" };
  }
  if (!category || !description) {
    return { error: "Danh mục và diễn giải là bắt buộc" };
  }
  if (!Number.isFinite(amount) || amount <= 0) {
    return { error: "Số tiền phải lớn hơn 0" };
  }

  return {
    values: {
      transaction_type: transactionType,
      payment_channel: paymentChannel,
      occurred_at: occurredAt,
      document_number:
        String(body.documentNumber || "").trim() || null,
      category,
      description,
      amount,
      counterparty: String(body.counterparty || "").trim() || null,
      affects_tax_revenue:
        transactionType === "income" && Boolean(body.affectsTaxRevenue),
      notes: String(body.notes || "").trim() || null,
    },
  };
}

function mapTransaction(row: Record<string, unknown>) {
  return {
    id: String(row.id),
    transactionType: row.transaction_type,
    paymentChannel: row.payment_channel,
    occurredAt: row.occurred_at,
    documentNumber: row.document_number || "",
    category: row.category,
    description: row.description,
    amount: Number(row.amount || 0),
    counterparty: row.counterparty || "",
    affectsTaxRevenue: Boolean(row.affects_tax_revenue),
    notes: row.notes || "",
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function GET(request: NextRequest) {
  try {
    const auth = await requireAdminRole();
    if (isAdminAuthFailure(auth)) return auth.response;

    const supabase = createServiceRoleSupabaseClient();
    if (!supabase) {
      return NextResponse.json(
        { error: "Thiếu cấu hình SUPABASE_SERVICE_ROLE_KEY" },
        { status: 500 },
      );
    }

    const params = new URL(request.url).searchParams;
    const page = Math.max(1, Number(params.get("page")) || 1);
    const pageSize = Math.min(
      100,
      Math.max(1, Number(params.get("pageSize")) || 20),
    );
    const type = params.get("type");
    const channel = params.get("channel");
    const from = params.get("from");
    const to = params.get("to");
    const search = String(params.get("search") || "")
      .trim()
      .replace(/[%_,()]/g, " ")
      .slice(0, 100);

    let query = supabase
      .from("financial_transactions")
      .select("*", { count: "exact" });

    if (type === "income" || type === "expense") {
      query = query.eq("transaction_type", type);
    }
    if (channel === "cash" || channel === "bank") {
      query = query.eq("payment_channel", channel);
    }
    if (from && DATE_PATTERN.test(from)) query = query.gte("occurred_at", from);
    if (to && DATE_PATTERN.test(to)) query = query.lte("occurred_at", to);
    if (search) {
      query = query.or(
        `description.ilike.%${search}%,category.ilike.%${search}%,counterparty.ilike.%${search}%,document_number.ilike.%${search}%`,
      );
    }

    const fromIndex = (page - 1) * pageSize;
    const { data, count, error } = await query
      .order("occurred_at", { ascending: false })
      .order("created_at", { ascending: false })
      .range(fromIndex, fromIndex + pageSize - 1);

    if (error) {
      if (isMissingSchema(error)) return schemaErrorResponse();
      throw error;
    }

    return NextResponse.json(
      {
        transactions: (data || []).map((row) =>
          mapTransaction(row as Record<string, unknown>),
        ),
        pagination: { page, pageSize, total: count || 0 },
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    console.error("Error loading financial transactions:", error);
    return NextResponse.json(
      { error: "Không thể tải sổ thu–chi" },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await requireAdminRole();
    if (isAdminAuthFailure(auth)) return auth.response;

    const body = (await request.json()) as TransactionBody;
    const validated = validateBody(body);
    if ("error" in validated) {
      return NextResponse.json({ error: validated.error }, { status: 400 });
    }

    const supabase = createServiceRoleSupabaseClient();
    if (!supabase) {
      return NextResponse.json(
        { error: "Thiếu cấu hình SUPABASE_SERVICE_ROLE_KEY" },
        { status: 500 },
      );
    }

    const { data, error } = await supabase
      .from("financial_transactions")
      .insert({
        ...validated.values,
        created_by: auth.user.email || auth.user.id,
      })
      .select("*")
      .single();

    if (error) {
      if (isMissingSchema(error)) return schemaErrorResponse();
      throw error;
    }

    return NextResponse.json(
      { transaction: mapTransaction(data as Record<string, unknown>) },
      { status: 201 },
    );
  } catch (error) {
    console.error("Error creating financial transaction:", error);
    return NextResponse.json(
      { error: "Không thể thêm giao dịch" },
      { status: 500 },
    );
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const auth = await requireAdminRole();
    if (isAdminAuthFailure(auth)) return auth.response;

    const body = (await request.json()) as TransactionBody;
    if (!body.id) {
      return NextResponse.json(
        { error: "Thiếu mã giao dịch" },
        { status: 400 },
      );
    }

    const validated = validateBody(body);
    if ("error" in validated) {
      return NextResponse.json({ error: validated.error }, { status: 400 });
    }

    const supabase = createServiceRoleSupabaseClient();
    if (!supabase) {
      return NextResponse.json(
        { error: "Thiếu cấu hình SUPABASE_SERVICE_ROLE_KEY" },
        { status: 500 },
      );
    }

    const { data, error } = await supabase
      .from("financial_transactions")
      .update(validated.values)
      .eq("id", body.id)
      .select("*")
      .single();

    if (error) {
      if (isMissingSchema(error)) return schemaErrorResponse();
      throw error;
    }

    return NextResponse.json({
      transaction: mapTransaction(data as Record<string, unknown>),
    });
  } catch (error) {
    console.error("Error updating financial transaction:", error);
    return NextResponse.json(
      { error: "Không thể cập nhật giao dịch" },
      { status: 500 },
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const auth = await requireAdminRole();
    if (isAdminAuthFailure(auth)) return auth.response;

    const id = new URL(request.url).searchParams.get("id");
    if (!id) {
      return NextResponse.json(
        { error: "Thiếu mã giao dịch" },
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
      .from("financial_transactions")
      .delete()
      .eq("id", id);
    if (error) {
      if (isMissingSchema(error)) return schemaErrorResponse();
      throw error;
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting financial transaction:", error);
    return NextResponse.json(
      { error: "Không thể xóa giao dịch" },
      { status: 500 },
    );
  }
}
