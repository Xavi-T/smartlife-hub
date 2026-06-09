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

export async function GET(request: NextRequest) {
  try {
    const auth = await requireAdminRole([...NUTRITION_ROLES]);
    if (isAdminAuthFailure(auth)) return auth.response;

    const { searchParams } = new URL(request.url);
    const search = (searchParams.get("search") || "").trim().toLowerCase();
    const status = searchParams.get("status") || "all";

    const supabase = getAdminClient();
    let query = supabase
      .from("nutrition_clients")
      .select("*")
      .order("updated_at", { ascending: false });

    if (VALID_STATUSES.includes(status as NutritionClientStatus)) {
      query = query.eq("status", status);
    }

    const [{ data: clients, error }, { data: assessments }] =
      await Promise.all([
        query,
        supabase
          .from("nutrition_assessments")
          .select("client_id, assessed_at")
          .order("assessed_at", { ascending: false }),
      ]);

    if (error) throw error;

    const assessmentStats = new Map<
      string,
      { assessment_count: number; latest_assessment_at: string | null }
    >();
    (assessments || []).forEach((item) => {
      const current = assessmentStats.get(item.client_id) || {
        assessment_count: 0,
        latest_assessment_at: null,
      };
      current.assessment_count += 1;
      if (!current.latest_assessment_at) {
        current.latest_assessment_at = item.assessed_at;
      }
      assessmentStats.set(item.client_id, current);
    });

    let rows = (clients || []).map((client) => ({
      ...client,
      ...(assessmentStats.get(client.id) || {
        assessment_count: 0,
        latest_assessment_at: null,
      }),
    }));

    if (search) {
      rows = rows.filter((client) => {
        const haystack = `${client.full_name} ${client.phone}`.toLowerCase();
        return haystack.includes(search);
      });
    }

    const stats = {
      total: rows.length,
      active: rows.filter((item) => item.status === "active").length,
      new: rows.filter((item) => item.status === "new").length,
      paused: rows.filter((item) => item.status === "paused").length,
      completed: rows.filter((item) => item.status === "completed").length,
    };

    return NextResponse.json({ clients: rows, stats });
  } catch (error: unknown) {
    console.error("Error fetching nutrition clients:", error);
    return NextResponse.json(
      { error: getErrorMessage(error) || "Không thể tải hồ sơ tư vấn" },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await requireAdminRole([...NUTRITION_ROLES]);
    if (isAdminAuthFailure(auth)) return auth.response;

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
      : "new";
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
      .insert({
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
        created_by: auth.user.id,
      })
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({
      success: true,
      client: data,
      message: "Đã tạo hồ sơ tư vấn",
    });
  } catch (error: unknown) {
    console.error("Error creating nutrition client:", error);
    return NextResponse.json(
      { error: getErrorMessage(error) || "Không thể tạo hồ sơ" },
      { status: 500 },
    );
  }
}
