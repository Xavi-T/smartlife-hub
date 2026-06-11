import { NextRequest, NextResponse } from "next/server";
import { createServiceRoleSupabaseClient } from "@/lib/supabase-admin";
import { sendConsultationNotificationEmail } from "@/lib/emailNotifications";
import {
  calculateNutritionMetrics,
  getActivityLevelLabel,
  getNutritionGoalLabel,
  normalizePhone,
  type NutritionActivityLevel,
  type NutritionGender,
  type NutritionGoal,
} from "@/lib/nutrition";

export const dynamic = "force-dynamic";

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
const RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000;
const RATE_LIMIT_MAX_SUBMISSIONS = 5;
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();

type NutritionClientRow = {
  id: string;
  full_name: string;
  phone: string;
  status: string;
  medical_notes: string | null;
  allergies: string | null;
};

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

function cleanText(value: unknown, maxLength = 1200): string {
  return String(value || "")
    .trim()
    .replace(/\s+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .slice(0, maxLength);
}

function toNumberOrNull(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function normalizeGender(value: unknown): NutritionGender {
  return VALID_GENDERS.includes(value as NutritionGender)
    ? (value as NutritionGender)
    : "female";
}

function normalizeActivityLevel(value: unknown): NutritionActivityLevel {
  return VALID_ACTIVITY_LEVELS.includes(value as NutritionActivityLevel)
    ? (value as NutritionActivityLevel)
    : "light";
}

function normalizeGoal(value: unknown): NutritionGoal {
  return VALID_GOALS.includes(value as NutritionGoal)
    ? (value as NutritionGoal)
    : "maintain";
}

function hasCompleteCalculationInput(input: {
  ageYears: number | null;
  heightCm: number | null;
  weightKg: number | null;
}) {
  return (
    input.ageYears !== null &&
    input.heightCm !== null &&
    input.weightKg !== null &&
    input.ageYears > 0 &&
    input.heightCm > 0 &&
    input.weightKg > 0
  );
}

function mergeNote(nextNote: string, previousNote?: string | null): string {
  if (!previousNote) return nextNote;
  return `${nextNote}\n\n--- Ghi chú trước đó ---\n${previousNote}`.slice(
    0,
    4000,
  );
}

function buildPublicNote(input: {
  source: string;
  sourcePath: string;
  requestType: string;
  preferredTime: string;
  message: string;
  medicalNotes: string;
  ageYears: number | null;
  activityLevel: NutritionActivityLevel;
  goal: NutritionGoal;
}) {
  return [
    `Lead public: ${new Date().toLocaleString("vi-VN", {
      timeZone: "Asia/Ho_Chi_Minh",
    })}`,
    `Nguồn: ${input.source}`,
    input.sourcePath ? `Trang gửi: ${input.sourcePath}` : "",
    `Nhu cầu: ${input.requestType}`,
    input.preferredTime
      ? `Thời gian mong muốn: ${input.preferredTime}`
      : "Thời gian mong muốn: Chưa có",
    input.ageYears ? `Tuổi: ${input.ageYears}` : "",
    `Mục tiêu: ${getNutritionGoalLabel(input.goal)}`,
    `Vận động: ${getActivityLevelLabel(input.activityLevel)}`,
    input.medicalNotes ? `Tình trạng sức khỏe: ${input.medicalNotes}` : "",
    input.message ? `Ghi chú khách gửi: ${input.message}` : "",
  ]
    .filter(Boolean)
    .join("\n");
}

function getRateLimitKey(request: NextRequest, phone: string): string {
  const forwardedFor = request.headers.get("x-forwarded-for") || "";
  const realIp = request.headers.get("x-real-ip") || "";
  const ip =
    forwardedFor
      .split(",")
      .map((item) => item.trim())
      .find(Boolean) ||
    realIp ||
    "unknown";

  return `${ip}:${phone || "no-phone"}`;
}

function isRateLimited(key: string): boolean {
  const now = Date.now();
  const current = rateLimitMap.get(key);

  if (rateLimitMap.size > 500) {
    rateLimitMap.forEach((value, entryKey) => {
      if (value.resetAt <= now) {
        rateLimitMap.delete(entryKey);
      }
    });
  }

  if (!current || current.resetAt <= now) {
    rateLimitMap.set(key, {
      count: 1,
      resetAt: now + RATE_LIMIT_WINDOW_MS,
    });
    return false;
  }

  if (current.count >= RATE_LIMIT_MAX_SUBMISSIONS) {
    return true;
  }

  current.count += 1;
  rateLimitMap.set(key, current);
  return false;
}

export async function POST(request: NextRequest) {
  let emailErrorMessage = "";

  try {
    const body = await request.json();
    const fullName = cleanText(body.fullName, 160);
    const phone = normalizePhone(String(body.phone || ""));
    const source = cleanText(body.source, 80) || "public_website";
    const sourcePath = cleanText(body.sourcePath, 500);
    const requestType =
      cleanText(body.requestType, 160) || "Tư vấn dinh dưỡng";
    const preferredTime = cleanText(body.preferredTime, 160);
    const message = cleanText(body.message, 1200);
    const medicalNotes = cleanText(body.medicalNotes, 1200);
    const allergies = cleanText(body.allergies, 800);
    const consentGiven = Boolean(body.consentGiven);
    const gender = normalizeGender(body.gender);
    const activityLevel = normalizeActivityLevel(body.activityLevel);
    const goal = normalizeGoal(body.goal);
    const ageYears = toNumberOrNull(body.ageYears);
    const heightCm = toNumberOrNull(body.heightCm);
    const weightKg = toNumberOrNull(body.weightKg);
    const honeypot = cleanText(body.website, 200);

    if (honeypot) {
      return NextResponse.json({
        success: true,
        emailSent: false,
        message:
          "SmartLife Hub đã nhận thông tin. Bác sĩ/chuyên viên sẽ liên hệ lại sớm.",
      });
    }

    if (!fullName || phone.length < 8) {
      return NextResponse.json(
        { error: "Tên và số điện thoại hợp lệ là bắt buộc" },
        { status: 400 },
      );
    }

    if (isRateLimited(getRateLimitKey(request, phone))) {
      return NextResponse.json(
        {
          error:
            "Bạn đã gửi nhiều yêu cầu trong thời gian ngắn. Vui lòng thử lại sau.",
        },
        { status: 429 },
      );
    }

    if (!consentGiven) {
      return NextResponse.json(
        { error: "Vui lòng đồng ý để SmartLife Hub liên hệ tư vấn" },
        { status: 400 },
      );
    }

    const publicNote = buildPublicNote({
      source,
      sourcePath,
      requestType,
      preferredTime,
      message,
      medicalNotes,
      ageYears,
      activityLevel,
      goal,
    });

    const supabase = getAdminClient();
    const { data: existingClient } = await supabase
      .from("nutrition_clients")
      .select("id, full_name, phone, status, medical_notes, allergies")
      .eq("phone", phone)
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle<NutritionClientRow>();

    let client: NutritionClientRow;
    if (existingClient) {
      const { data, error } = await supabase
        .from("nutrition_clients")
        .update({
          full_name: fullName,
          gender,
          height_cm: heightCm,
          weight_kg: weightKg,
          activity_level: activityLevel,
          goal,
          medical_notes: mergeNote(publicNote, existingClient.medical_notes),
          allergies: allergies || existingClient.allergies,
          status:
            existingClient.status === "completed"
              ? "active"
              : existingClient.status,
          consent_given: true,
          consent_at: new Date().toISOString(),
        })
        .eq("id", existingClient.id)
        .select("id, full_name, phone, status, medical_notes, allergies")
        .single<NutritionClientRow>();

      if (error) throw error;
      client = data;
    } else {
      const { data, error } = await supabase
        .from("nutrition_clients")
        .insert({
          full_name: fullName,
          phone,
          gender,
          birth_date: null,
          height_cm: heightCm,
          weight_kg: weightKg,
          activity_level: activityLevel,
          goal,
          medical_notes: publicNote,
          allergies: allergies || null,
          doctor_notes: null,
          status: "new",
          consent_given: true,
          consent_at: new Date().toISOString(),
          created_by: null,
        })
        .select("id, full_name, phone, status, medical_notes, allergies")
        .single<NutritionClientRow>();

      if (error) throw error;
      client = data;
    }

    let assessmentId: string | null = null;
    let calculated:
      | ReturnType<typeof calculateNutritionMetrics>
      | null = null;

    if (hasCompleteCalculationInput({ ageYears, heightCm, weightKg })) {
      calculated = calculateNutritionMetrics({
        ageYears: Number(ageYears),
        heightCm: Number(heightCm),
        weightKg: Number(weightKg),
        gender,
        activityLevel,
        goal,
      });

      const { data: assessment, error } = await supabase
        .from("nutrition_assessments")
        .insert({
          client_id: client.id,
          assessed_at: new Date().toISOString(),
          age_years: Number(ageYears),
          gender,
          height_cm: Number(heightCm),
          weight_kg: Number(weightKg),
          activity_level: activityLevel,
          goal,
          bmi: calculated.bmi,
          bmi_category: calculated.bmiCategory,
          bmr: calculated.bmr,
          tdee: calculated.tdee,
          target_calories: calculated.targetCalories,
          protein_g: calculated.proteinG,
          fat_g: calculated.fatG,
          carb_g: calculated.carbG,
          doctor_notes: null,
          recommendation_text: publicNote,
          related_product_ids: [],
          formula_version: calculated.formulaVersion,
          created_by: null,
        })
        .select("id")
        .single<{ id: string }>();

      if (error) throw error;
      assessmentId = assessment.id;
    }

    let emailSent = false;
    try {
      emailSent = await sendConsultationNotificationEmail({
        clientId: client.id,
        assessmentId,
        fullName,
        phone,
        source,
        sourcePath,
        requestType,
        preferredTime,
        medicalNotes,
        allergies,
        message,
        calculation: calculated
          ? {
              ageYears,
              gender,
              heightCm,
              weightKg,
              activityLevel,
              goal,
              bmi: calculated.bmi,
              bmiCategory: calculated.bmiCategory,
              bmr: calculated.bmr,
              tdee: calculated.tdee,
              targetCalories: calculated.targetCalories,
              proteinG: calculated.proteinG,
              fatG: calculated.fatG,
              carbG: calculated.carbG,
            }
          : {
              ageYears,
              gender,
              heightCm,
              weightKg,
              activityLevel,
              goal,
            },
      });
    } catch (emailError: unknown) {
      console.error("Error sending consultation email:", emailError);
      emailErrorMessage = getErrorMessage(emailError);
    }

    return NextResponse.json({
      success: true,
      clientId: client.id,
      assessmentId,
      emailSent,
      emailWarning: emailSent
        ? null
        : emailErrorMessage
          ? "Đã lưu thông tin nhưng chưa gửi được email thông báo"
          : "Đã lưu thông tin nhưng EmailJS chưa được cấu hình để gửi email",
      message:
        "SmartLife Hub đã nhận thông tin. Bác sĩ/chuyên viên sẽ liên hệ lại sớm.",
    });
  } catch (error: unknown) {
    console.error("Error creating public nutrition consultation:", error);
    return NextResponse.json(
      { error: getErrorMessage(error) || "Không thể gửi thông tin tư vấn" },
      { status: 500 },
    );
  }
}
