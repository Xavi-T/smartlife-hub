import { NextRequest, NextResponse } from "next/server";
import { isAdminAuthFailure, requireAdminRole } from "@/lib/adminAuth";
import { createServiceRoleSupabaseClient } from "@/lib/supabase-admin";
import {
  calculateNutritionMetrics,
  type NutritionActivityLevel,
  type NutritionGender,
  type NutritionGoal,
} from "@/lib/nutrition";

const NUTRITION_ROLES = ["admin", "manager"] as const;
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

function normalizeProductIds(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return Array.from(
    new Set(
      value
        .map((item) => String(item || "").trim())
        .filter((item) => /^[0-9a-f-]{36}$/i.test(item)),
    ),
  );
}

export async function GET(request: NextRequest) {
  try {
    const auth = await requireAdminRole([...NUTRITION_ROLES]);
    if (isAdminAuthFailure(auth)) return auth.response;

    const clientId = new URL(request.url).searchParams.get("clientId") || "";
    if (!clientId) {
      return NextResponse.json(
        { error: "clientId là bắt buộc" },
        { status: 400 },
      );
    }

    const supabase = getAdminClient();
    const { data, error } = await supabase
      .from("nutrition_assessments")
      .select("*")
      .eq("client_id", clientId)
      .order("assessed_at", { ascending: false });

    if (error) throw error;

    return NextResponse.json({ assessments: data || [] });
  } catch (error: unknown) {
    console.error("Error fetching nutrition assessments:", error);
    return NextResponse.json(
      { error: getErrorMessage(error) || "Không thể tải lịch sử đánh giá" },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await requireAdminRole([...NUTRITION_ROLES]);
    if (isAdminAuthFailure(auth)) return auth.response;

    const body = await request.json();
    const clientId = String(body.clientId || "").trim();
    const ageYears = Number(body.ageYears || 0);
    const heightCm = Number(body.heightCm || 0);
    const weightKg = Number(body.weightKg || 0);
    const gender = VALID_GENDERS.includes(body.gender)
      ? (body.gender as NutritionGender)
      : "female";
    const activityLevel = VALID_ACTIVITY_LEVELS.includes(body.activityLevel)
      ? (body.activityLevel as NutritionActivityLevel)
      : "light";
    const goal = VALID_GOALS.includes(body.goal)
      ? (body.goal as NutritionGoal)
      : "maintain";

    if (!clientId || ageYears <= 0 || heightCm <= 0 || weightKg <= 0) {
      return NextResponse.json(
        { error: "Khách hàng, tuổi, chiều cao và cân nặng là bắt buộc" },
        { status: 400 },
      );
    }

    const calculated = calculateNutritionMetrics({
      gender,
      ageYears,
      heightCm,
      weightKg,
      activityLevel,
      goal,
    });

    const supabase = getAdminClient();
    const { data, error } = await supabase
      .from("nutrition_assessments")
      .insert({
        client_id: clientId,
        assessed_at: new Date().toISOString(),
        age_years: ageYears,
        gender,
        height_cm: heightCm,
        weight_kg: weightKg,
        activity_level: activityLevel,
        goal,
        bmi: Number(body.bmi || calculated.bmi),
        bmi_category: String(body.bmiCategory || calculated.bmiCategory),
        bmr: Number(body.bmr || calculated.bmr),
        tdee: Number(body.tdee || calculated.tdee),
        target_calories: Number(
          body.targetCalories || calculated.targetCalories,
        ),
        protein_g: Number(body.proteinG || calculated.proteinG),
        fat_g: Number(body.fatG || calculated.fatG),
        carb_g: Number(body.carbG || calculated.carbG),
        doctor_notes: String(body.doctorNotes || "").trim() || null,
        recommendation_text:
          String(body.recommendationText || "").trim() || null,
        related_product_ids: normalizeProductIds(body.relatedProductIds),
        formula_version: calculated.formulaVersion,
        created_by: auth.user.id,
      })
      .select()
      .single();

    if (error) throw error;

    await supabase
      .from("nutrition_clients")
      .update({
        height_cm: heightCm,
        weight_kg: weightKg,
        gender,
        activity_level: activityLevel,
        goal,
      })
      .eq("id", clientId);

    return NextResponse.json({
      success: true,
      assessment: data,
      message: "Đã lưu đánh giá dinh dưỡng",
    });
  } catch (error: unknown) {
    console.error("Error creating nutrition assessment:", error);
    return NextResponse.json(
      { error: getErrorMessage(error) || "Không thể lưu đánh giá" },
      { status: 500 },
    );
  }
}
