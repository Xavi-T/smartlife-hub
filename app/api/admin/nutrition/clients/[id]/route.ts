import { NextRequest, NextResponse } from "next/server";
import { isAdminAuthFailure, requireAdminRole } from "@/lib/adminAuth";
import { createServiceRoleSupabaseClient } from "@/lib/supabase-admin";
import {
  normalizePhone,
  type NutritionActivityLevel,
  type NutritionGender,
  type NutritionGoal,
} from "@/lib/nutrition";
import type { NutritionClientStatus } from "@/types/database";

const NUTRITION_ROLES = ["admin", "manager", "doctor"] as const;
const VALID_GENDERS: NutritionGender[] = ["male", "female", "other"];
const VALID_ACTIVITY_LEVELS: NutritionActivityLevel[] = [
  "sedentary",
  "light",
  "moderate",
  "active",
  "very_active",
];
const VALID_GOALS: NutritionGoal[] = [
  "lose_weight",
  "maintain",
  "gain_weight",
  "improve_health",
];
const VALID_STATUSES: NutritionClientStatus[] = [
  "new",
  "active",
  "paused",
  "completed",
];

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

function toNumberOrNull(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function toDateOrNull(value: unknown): string | null {
  if (!value) return null;
  const parsed = new Date(String(value));
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toISOString().slice(0, 10);
}

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const auth = await requireAdminRole([...NUTRITION_ROLES]);
    if (isAdminAuthFailure(auth)) return auth.response;

    const { id } = await context.params;
    const supabase = getAdminClient();
    const [
      { data: client, error },
      { data: assessments },
      { data: consultationNotes },
    ] = await Promise.all([
      supabase.from("nutrition_clients").select("*").eq("id", id).single(),
      supabase
        .from("nutrition_assessments")
        .select("*")
        .eq("client_id", id)
        .order("assessed_at", { ascending: false }),
      supabase
        .from("nutrition_consultation_notes")
        .select("*")
        .eq("client_id", id)
        .order("created_at", { ascending: false }),
    ]);

    if (error) throw error;

    return NextResponse.json({
      client,
      assessments: assessments || [],
      consultationNotes: consultationNotes || [],
    });
  } catch (error: unknown) {
    console.error("Error fetching nutrition client:", error);
    return NextResponse.json(
      { error: getErrorMessage(error) || "Không thể tải hồ sơ" },
      { status: 500 },
    );
  }
}

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const auth = await requireAdminRole([...NUTRITION_ROLES]);
    if (isAdminAuthFailure(auth)) return auth.response;

    const { id } = await context.params;
    const body = await request.json();
    const fullName = String(body.fullName || "").trim();
    const phone = normalizePhone(String(body.phone || ""));
    const gender = VALID_GENDERS.includes(body.gender)
      ? (body.gender as NutritionGender)
      : "female";
    const activityLevel = VALID_ACTIVITY_LEVELS.includes(body.activityLevel)
      ? (body.activityLevel as NutritionActivityLevel)
      : "light";
    const goal = VALID_GOALS.includes(body.goal)
      ? (body.goal as NutritionGoal)
      : "maintain";
    const status = VALID_STATUSES.includes(body.status)
      ? (body.status as NutritionClientStatus)
      : "active";
    const consentGiven = Boolean(body.consentGiven);

    if (!fullName || phone.length < 8) {
      return NextResponse.json(
        { error: "Tên khách hàng và SĐT hợp lệ là bắt buộc" },
        { status: 400 },
      );
    }

    const supabase = getAdminClient();
    const { data, error } = await supabase
      .from("nutrition_clients")
      .update({
        full_name: fullName,
        phone,
        gender,
        birth_date: toDateOrNull(body.birthDate),
        height_cm: toNumberOrNull(body.heightCm),
        weight_kg: toNumberOrNull(body.weightKg),
        activity_level: activityLevel,
        goal,
        medical_notes: String(body.medicalNotes || "").trim() || null,
        allergies: String(body.allergies || "").trim() || null,
        doctor_notes: String(body.doctorNotes || "").trim() || null,
        status,
        consent_given: consentGiven,
        consent_at: consentGiven ? new Date().toISOString() : null,
      })
      .eq("id", id)
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({
      success: true,
      client: data,
      message: "Đã cập nhật hồ sơ tư vấn",
    });
  } catch (error: unknown) {
    console.error("Error updating nutrition client:", error);
    return NextResponse.json(
      { error: getErrorMessage(error) || "Không thể cập nhật hồ sơ" },
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
      .from("nutrition_clients")
      .delete()
      .eq("id", id);

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    console.error("Error deleting nutrition client:", error);
    return NextResponse.json(
      { error: getErrorMessage(error) || "Không thể xóa hồ sơ" },
      { status: 500 },
    );
  }
}
