import { NextRequest, NextResponse } from "next/server";
import { isAdminAuthFailure, requireAdminRole } from "@/lib/adminAuth";
import { createServiceRoleSupabaseClient } from "@/lib/supabase-admin";
import {
  getErrorMessage,
  normalizeActivityLevel,
  normalizeGender,
  normalizeGoal,
  normalizeNoteStatus,
  normalizeOptionalPhone,
  NUTRITION_ROLES,
  toDateOrNull,
  toNullableString,
  toNumberOrNull,
} from "@/lib/nutritionConsultationNotes";

function getAdminClient() {
  const client = createServiceRoleSupabaseClient();
  if (!client) {
    throw new Error("Thiếu cấu hình SUPABASE_SERVICE_ROLE_KEY");
  }
  return client;
}

function buildPayload(body: Record<string, unknown>) {
  return {
    full_name: toNullableString(body.fullName),
    phone: normalizeOptionalPhone(body.phone),
    gender: normalizeGender(body.gender),
    birth_date: toDateOrNull(body.birthDate),
    age_years: toNumberOrNull(body.ageYears),
    height_cm: toNumberOrNull(body.heightCm),
    weight_kg: toNumberOrNull(body.weightKg),
    activity_level: normalizeActivityLevel(body.activityLevel),
    goal: normalizeGoal(body.goal),
    medical_notes: toNullableString(body.medicalNotes),
    allergies: toNullableString(body.allergies),
    current_diet: toNullableString(body.currentDiet),
    quick_note: String(body.quickNote || "").trim(),
    recommendation: toNullableString(body.recommendation),
    status: normalizeNoteStatus(body.status),
  };
}

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const auth = await requireAdminRole([...NUTRITION_ROLES]);
    if (isAdminAuthFailure(auth)) return auth.response;

    const { id } = await context.params;
    const body = (await request.json()) as Record<string, unknown>;
    const payload = buildPayload(body);

    if (!payload.quick_note && !payload.full_name && !payload.phone) {
      return NextResponse.json(
        { error: "Vui lòng nhập ít nhất tên, SĐT hoặc nội dung note" },
        { status: 400 },
      );
    }

    const supabase = getAdminClient();
    const { data, error } = await supabase
      .from("nutrition_consultation_notes")
      .update(payload)
      .eq("id", id)
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({
      success: true,
      note: data,
      message: "Đã cập nhật note tư vấn",
    });
  } catch (error: unknown) {
    console.error("Error updating nutrition consultation note:", error);
    return NextResponse.json(
      { error: getErrorMessage(error) || "Không thể cập nhật note tư vấn" },
      { status: 500 },
    );
  }
}

export async function DELETE(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const auth = await requireAdminRole([...NUTRITION_ROLES]);
    if (isAdminAuthFailure(auth)) return auth.response;

    const { id } = await context.params;
    const supabase = getAdminClient();
    const { error } = await supabase
      .from("nutrition_consultation_notes")
      .delete()
      .eq("id", id);

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    console.error("Error deleting nutrition consultation note:", error);
    return NextResponse.json(
      { error: getErrorMessage(error) || "Không thể xóa note tư vấn" },
      { status: 500 },
    );
  }
}
