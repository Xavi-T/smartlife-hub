import {
  type NutritionActivityLevel,
  type NutritionGender,
  type NutritionGoal,
  normalizePhone,
} from "@/lib/nutrition";
import type { NutritionConsultationNoteStatus } from "@/types/database";

export const NUTRITION_ROLES = ["admin", "manager"] as const;

export const VALID_NOTE_STATUSES: NutritionConsultationNoteStatus[] = [
  "draft",
  "converted",
  "archived",
];

export const VALID_GENDERS: NutritionGender[] = ["male", "female", "other"];
export const VALID_ACTIVITY_LEVELS: NutritionActivityLevel[] = [
  "sedentary",
  "light",
  "moderate",
  "active",
  "very_active",
];
export const VALID_GOALS: NutritionGoal[] = [
  "lose_weight",
  "maintain",
  "gain_weight",
  "improve_health",
];

export function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  return "Đã xảy ra lỗi";
}

export function toNullableString(value: unknown): string | null {
  const normalized = String(value || "").trim();
  return normalized || null;
}

export function toNumberOrNull(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export function toDateOrNull(value: unknown): string | null {
  if (!value) return null;
  const parsed = new Date(String(value));
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toISOString().slice(0, 10);
}

export function normalizeOptionalPhone(value: unknown): string | null {
  const phone = normalizePhone(String(value || ""));
  return phone || null;
}

export function normalizeNoteStatus(
  value: unknown,
  fallback: NutritionConsultationNoteStatus = "draft",
): NutritionConsultationNoteStatus {
  return VALID_NOTE_STATUSES.includes(value as NutritionConsultationNoteStatus)
    ? (value as NutritionConsultationNoteStatus)
    : fallback;
}

export function normalizeGender(value: unknown): NutritionGender | null {
  return VALID_GENDERS.includes(value as NutritionGender)
    ? (value as NutritionGender)
    : null;
}

export function normalizeActivityLevel(
  value: unknown,
): NutritionActivityLevel | null {
  return VALID_ACTIVITY_LEVELS.includes(value as NutritionActivityLevel)
    ? (value as NutritionActivityLevel)
    : null;
}

export function normalizeGoal(value: unknown): NutritionGoal | null {
  return VALID_GOALS.includes(value as NutritionGoal)
    ? (value as NutritionGoal)
    : null;
}

export function createInternalConsultationPhone(): string {
  const timestamp = Date.now().toString();
  const random = Math.floor(Math.random() * 1000)
    .toString()
    .padStart(3, "0");
  return `999${timestamp}${random}`.slice(0, 20);
}

export function isInternalConsultationPhone(value: unknown): boolean {
  return normalizePhone(String(value || "")).startsWith("999");
}

export function getDisplayNutritionPhone(value: unknown): string {
  const phone = normalizePhone(String(value || ""));
  return phone && !isInternalConsultationPhone(phone) ? phone : "Chưa có SĐT";
}

export function buildNoteSummary(note: {
  quick_note?: string | null;
  medical_notes?: string | null;
  allergies?: string | null;
  current_diet?: string | null;
  recommendation?: string | null;
}): string {
  const lines = [
    note.quick_note ? `Note nhanh: ${note.quick_note}` : "",
    note.medical_notes ? `Bệnh lý/lưu ý: ${note.medical_notes}` : "",
    note.allergies ? `Dị ứng/kiêng kỵ: ${note.allergies}` : "",
    note.current_diet ? `Ăn uống hiện tại: ${note.current_diet}` : "",
    note.recommendation ? `Hướng xử lý: ${note.recommendation}` : "",
  ].filter(Boolean);

  return lines.join("\n");
}
