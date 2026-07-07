import { NextRequest, NextResponse } from "next/server";
import { isAdminAuthFailure, requireAdminRole } from "@/lib/adminAuth";
import { createServiceRoleSupabaseClient } from "@/lib/supabase-admin";
import {
  buildNoteSummary,
  createInternalConsultationPhone,
  getErrorMessage,
  normalizeActivityLevel,
  normalizeGender,
  normalizeGoal,
  normalizeOptionalPhone,
  NUTRITION_ROLES,
  toDateOrNull,
  toNullableString,
  toNumberOrNull,
} from "@/lib/nutritionConsultationNotes";
import type {
  NutritionActivityLevel,
  NutritionClient,
  NutritionGender,
  NutritionGoal,
  NutritionConsultationNote,
} from "@/types/database";

function getAdminClient() {
  const client = createServiceRoleSupabaseClient();
  if (!client) {
    throw new Error("Thiếu cấu hình SUPABASE_SERVICE_ROLE_KEY");
  }
  return client;
}

function appendDoctorNote(previous: string | null, next: string): string | null {
  if (!next.trim()) return previous || null;
  const header = `Note tư vấn ${new Date().toLocaleString("vi-VN")}`;
  return [previous, `--- ${header} ---\n${next}`].filter(Boolean).join("\n\n");
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const auth = await requireAdminRole([...NUTRITION_ROLES]);
    if (isAdminAuthFailure(auth)) return auth.response;

    const { id } = await context.params;
    const body = (await request.json().catch(() => ({}))) as Record<
      string,
      unknown
    >;
    const supabase = getAdminClient();

    const { data: noteData, error: noteError } = await supabase
      .from("nutrition_consultation_notes")
      .select("*")
      .eq("id", id)
      .single();

    if (noteError) throw noteError;
    const note = noteData as NutritionConsultationNote;

    const requestedClientId = toNullableString(body.clientId);
    const fullName =
      toNullableString(body.fullName) ||
      note.full_name ||
      "Khách tư vấn dinh dưỡng";
    const phone =
      normalizeOptionalPhone(body.phone) ||
      note.phone ||
      createInternalConsultationPhone();
    const gender =
      normalizeGender(body.gender) ||
      note.gender ||
      ("female" as NutritionGender);
    const activityLevel =
      normalizeActivityLevel(body.activityLevel) ||
      note.activity_level ||
      ("light" as NutritionActivityLevel);
    const goal =
      normalizeGoal(body.goal) || note.goal || ("maintain" as NutritionGoal);
    const birthDate = toDateOrNull(body.birthDate) || note.birth_date || null;
    const heightCm = toNumberOrNull(body.heightCm) ?? note.height_cm;
    const weightKg = toNumberOrNull(body.weightKg) ?? note.weight_kg;
    const medicalNotes =
      toNullableString(body.medicalNotes) || note.medical_notes;
    const allergies = toNullableString(body.allergies) || note.allergies;
    const noteSummary = buildNoteSummary(note);

    let client: NutritionClient | null = null;

    if (requestedClientId) {
      const { data, error } = await supabase
        .from("nutrition_clients")
        .select("*")
        .eq("id", requestedClientId)
        .single();
      if (error) throw error;
      client = data as NutritionClient;
    }

    if (!client && phone.length >= 8 && !phone.startsWith("999")) {
      const { data, error } = await supabase
        .from("nutrition_clients")
        .select("*")
        .eq("phone", phone)
        .maybeSingle();
      if (error) throw error;
      client = (data || null) as NutritionClient | null;
    }

    if (client) {
      const { data, error } = await supabase
        .from("nutrition_clients")
        .update({
          full_name: client.full_name || fullName,
          gender: client.gender || gender,
          birth_date: client.birth_date || birthDate,
          height_cm: client.height_cm || heightCm,
          weight_kg: client.weight_kg || weightKg,
          activity_level: client.activity_level || activityLevel,
          goal: client.goal || goal,
          medical_notes: client.medical_notes || medicalNotes,
          allergies: client.allergies || allergies,
          doctor_notes: appendDoctorNote(client.doctor_notes, noteSummary),
          status: client.status === "completed" ? client.status : "active",
        })
        .eq("id", client.id)
        .select()
        .single();
      if (error) throw error;
      client = data as NutritionClient;
    } else {
      const { data, error } = await supabase
        .from("nutrition_clients")
        .insert({
          full_name: fullName,
          phone,
          gender,
          birth_date: birthDate,
          height_cm: heightCm,
          weight_kg: weightKg,
          activity_level: activityLevel,
          goal,
          medical_notes: medicalNotes,
          allergies,
          doctor_notes: noteSummary || null,
          status: "active",
          consent_given: body.consentGiven === false ? false : true,
          consent_at:
            body.consentGiven === false ? null : new Date().toISOString(),
          created_by: auth.user.id,
        })
        .select()
        .single();
      if (error) throw error;
      client = data as NutritionClient;
    }

    const { data: updatedNote, error: updateNoteError } = await supabase
      .from("nutrition_consultation_notes")
      .update({
        client_id: client.id,
        full_name: note.full_name || fullName,
        phone: note.phone || phone,
        gender: note.gender || gender,
        birth_date: note.birth_date || birthDate,
        height_cm: note.height_cm || heightCm,
        weight_kg: note.weight_kg || weightKg,
        activity_level: note.activity_level || activityLevel,
        goal: note.goal || goal,
        medical_notes: note.medical_notes || medicalNotes,
        allergies: note.allergies || allergies,
        status: "converted",
        converted_at: new Date().toISOString(),
      })
      .eq("id", note.id)
      .select()
      .single();

    if (updateNoteError) throw updateNoteError;

    return NextResponse.json({
      success: true,
      client,
      note: updatedNote,
      message: "Đã chuyển note thành hồ sơ tư vấn",
    });
  } catch (error: unknown) {
    console.error("Error converting nutrition consultation note:", error);
    return NextResponse.json(
      { error: getErrorMessage(error) || "Không thể chuyển note thành hồ sơ" },
      { status: 500 },
    );
  }
}
