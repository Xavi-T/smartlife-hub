import { NextRequest, NextResponse } from "next/server";
import { isAdminAuthFailure, requireAdminRole } from "@/lib/adminAuth";
import { createServiceRoleSupabaseClient } from "@/lib/supabase-admin";
import type { ClinicalNutritionProductUnit } from "@/types/database";

const NUTRITION_ROLES = ["admin", "manager", "doctor"] as const;
const VALID_UNITS: ClinicalNutritionProductUnit[] = ["ml", "g"];

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  return "Đã xảy ra lỗi";
}

function getAdminClient() {
  const client = createServiceRoleSupabaseClient();
  if (!client) {
    throw new Error("Thiếu cấu hình SUPABASE_SERVICE_ROLE_KEY");
  }
  return client;
}

function normalizeNumber(value: unknown): number {
  const numberValue = Number(value ?? 0);
  if (!Number.isFinite(numberValue)) return 0;
  return Math.max(0, numberValue);
}

function normalizeUnit(value: unknown): ClinicalNutritionProductUnit {
  return VALID_UNITS.includes(value as ClinicalNutritionProductUnit)
    ? (value as ClinicalNutritionProductUnit)
    : "ml";
}

function mapProductRow(row: Record<string, unknown>) {
  return {
    id: String(row.id || ""),
    name: String(row.name || ""),
    unit: normalizeUnit(row.unit),
    proteinPer100: Number(row.protein_per100 || 0),
    lipidPer100: Number(row.lipid_per100 || 0),
    glucosePer100: Number(row.glucose_per100 || 0),
    energyPer100: Number(row.energy_per100 || 0),
    note: row.note ? String(row.note) : undefined,
    isActive: row.is_active !== false,
    sortOrder: Number(row.sort_order || 0),
    createdAt: row.created_at ? String(row.created_at) : "",
    updatedAt: row.updated_at ? String(row.updated_at) : "",
  };
}

function buildPayload(body: Record<string, unknown>) {
  const name = String(body.name || "").trim();
  const unit = normalizeUnit(body.unit);

  return {
    name,
    unit,
    protein_per100: normalizeNumber(body.proteinPer100),
    lipid_per100: normalizeNumber(body.lipidPer100),
    glucose_per100: normalizeNumber(body.glucosePer100),
    energy_per100: normalizeNumber(body.energyPer100),
    note: String(body.note || "").trim() || null,
    is_active: body.isActive !== false,
    sort_order: Math.round(normalizeNumber(body.sortOrder)),
  };
}

export async function GET(request: NextRequest) {
  try {
    const auth = await requireAdminRole([...NUTRITION_ROLES]);
    if (isAdminAuthFailure(auth)) return auth.response;

    const activeOnly =
      new URL(request.url).searchParams.get("activeOnly") === "true";
    const supabase = getAdminClient();
    let query = supabase
      .from("clinical_nutrition_products")
      .select("*")
      .order("sort_order", { ascending: true })
      .order("name", { ascending: true });

    if (activeOnly) {
      query = query.eq("is_active", true);
    }

    const { data, error } = await query;
    if (error) throw error;

    return NextResponse.json({
      products: (data || []).map((row) => mapProductRow(row)),
    });
  } catch (error: unknown) {
    console.error("Error fetching clinical nutrition products:", error);
    return NextResponse.json(
      { error: getErrorMessage(error) || "Không thể tải danh mục sản phẩm" },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await requireAdminRole([...NUTRITION_ROLES]);
    if (isAdminAuthFailure(auth)) return auth.response;

    const body = (await request.json()) as Record<string, unknown>;
    const payload = buildPayload(body);

    if (payload.name.length < 2) {
      return NextResponse.json(
        { error: "Tên sản phẩm tối thiểu 2 ký tự" },
        { status: 400 },
      );
    }

    const supabase = getAdminClient();
    const { data, error } = await supabase
      .from("clinical_nutrition_products")
      .insert({
        ...payload,
        created_by: auth.user.id,
      })
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({
      success: true,
      product: mapProductRow(data),
      message: "Đã thêm sản phẩm tính toán",
    });
  } catch (error: unknown) {
    console.error("Error creating clinical nutrition product:", error);
    return NextResponse.json(
      { error: getErrorMessage(error) || "Không thể thêm sản phẩm" },
      { status: 500 },
    );
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const auth = await requireAdminRole([...NUTRITION_ROLES]);
    if (isAdminAuthFailure(auth)) return auth.response;

    const body = (await request.json()) as Record<string, unknown>;
    const id = String(body.id || "").trim();
    const payload = buildPayload(body);

    if (!id) {
      return NextResponse.json(
        { error: "ID sản phẩm là bắt buộc" },
        { status: 400 },
      );
    }

    if (payload.name.length < 2) {
      return NextResponse.json(
        { error: "Tên sản phẩm tối thiểu 2 ký tự" },
        { status: 400 },
      );
    }

    const supabase = getAdminClient();
    const { data, error } = await supabase
      .from("clinical_nutrition_products")
      .update(payload)
      .eq("id", id)
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({
      success: true,
      product: mapProductRow(data),
      message: "Đã cập nhật sản phẩm tính toán",
    });
  } catch (error: unknown) {
    console.error("Error updating clinical nutrition product:", error);
    return NextResponse.json(
      { error: getErrorMessage(error) || "Không thể cập nhật sản phẩm" },
      { status: 500 },
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const auth = await requireAdminRole([...NUTRITION_ROLES]);
    if (isAdminAuthFailure(auth)) return auth.response;

    const id = new URL(request.url).searchParams.get("id") || "";
    if (!id) {
      return NextResponse.json(
        { error: "ID sản phẩm là bắt buộc" },
        { status: 400 },
      );
    }

    const supabase = getAdminClient();
    const { error } = await supabase
      .from("clinical_nutrition_products")
      .delete()
      .eq("id", id);

    if (error) throw error;

    return NextResponse.json({
      success: true,
      message: "Đã xóa sản phẩm tính toán",
    });
  } catch (error: unknown) {
    console.error("Error deleting clinical nutrition product:", error);
    return NextResponse.json(
      { error: getErrorMessage(error) || "Không thể xóa sản phẩm" },
      { status: 500 },
    );
  }
}
