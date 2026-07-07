import { NextRequest, NextResponse } from "next/server";
import { isAdminAuthFailure, requireAdminRole } from "@/lib/adminAuth";
import { createServiceRoleSupabaseClient } from "@/lib/supabase-admin";
import { matchesSearchText } from "@/lib/searchText";
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
import type {
  NutritionConsultationNote,
  NutritionConsultationNoteStatus,
} from "@/types/database";

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

export async function GET(request: NextRequest) {
  try {
    const auth = await requireAdminRole([...NUTRITION_ROLES]);
    if (isAdminAuthFailure(auth)) return auth.response;

    const { searchParams } = new URL(request.url);
    const search = (searchParams.get("search") || "").trim();
    const status = searchParams.get("status") || "all";
    const clientId = (searchParams.get("clientId") || "").trim();
    const limit = Math.min(
      200,
      Math.max(1, Number(searchParams.get("limit") || 100)),
    );

    const supabase = getAdminClient();
    let query = supabase
      .from("nutrition_consultation_notes")
      .select(
        `
        *,
        nutrition_clients (
          id,
          full_name,
          phone
        )
      `,
      )
      .order("created_at", { ascending: false })
      .limit(limit);

    if (status !== "all") {
      query = query.eq(
        "status",
        normalizeNoteStatus(status, "draft") as NutritionConsultationNoteStatus,
      );
    }

    if (clientId) {
      query = query.eq("client_id", clientId);
    }

    const { data, error } = await query;
    if (error) throw error;

    let notes = (data || []) as Array<
      NutritionConsultationNote & {
        nutrition_clients?: {
          id: string;
          full_name: string;
          phone: string;
        } | null;
      }
    >;

    if (search) {
      notes = notes.filter((note) =>
        matchesSearchText(
          [
            note.full_name,
            note.phone,
            note.quick_note,
            note.medical_notes,
            note.allergies,
            note.current_diet,
            note.recommendation,
            note.nutrition_clients?.full_name,
            note.nutrition_clients?.phone,
          ].join(" "),
          search,
        ),
      );
    }

    const stats = {
      total: notes.length,
      draft: notes.filter((note) => note.status === "draft").length,
      converted: notes.filter((note) => note.status === "converted").length,
      archived: notes.filter((note) => note.status === "archived").length,
    };

    return NextResponse.json({ notes, stats });
  } catch (error: unknown) {
    console.error("Error fetching nutrition consultation notes:", error);
    return NextResponse.json(
      { error: getErrorMessage(error) || "Không thể tải note tư vấn" },
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

    if (!payload.quick_note && !payload.full_name && !payload.phone) {
      return NextResponse.json(
        { error: "Vui lòng nhập ít nhất tên, SĐT hoặc nội dung note" },
        { status: 400 },
      );
    }

    const supabase = getAdminClient();
    const { data, error } = await supabase
      .from("nutrition_consultation_notes")
      .insert({
        ...payload,
        client_id: toNullableString(body.clientId),
        created_by: auth.user.id,
      })
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({
      success: true,
      note: data,
      message: "Đã lưu note tư vấn",
    });
  } catch (error: unknown) {
    console.error("Error creating nutrition consultation note:", error);
    return NextResponse.json(
      { error: getErrorMessage(error) || "Không thể tạo note tư vấn" },
      { status: 500 },
    );
  }
}
