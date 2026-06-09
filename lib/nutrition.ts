export type NutritionGender = "male" | "female" | "other";
export type NutritionActivityLevel =
  | "sedentary"
  | "light"
  | "moderate"
  | "active"
  | "very_active";
export type NutritionGoal =
  | "lose_weight"
  | "maintain"
  | "gain_weight"
  | "improve_health";

export const ACTIVITY_LEVEL_OPTIONS: Array<{
  value: NutritionActivityLevel;
  label: string;
  multiplier: number;
}> = [
  { value: "sedentary", label: "Ít vận động", multiplier: 1.2 },
  { value: "light", label: "Vận động nhẹ", multiplier: 1.375 },
  { value: "moderate", label: "Vận động vừa", multiplier: 1.55 },
  { value: "active", label: "Vận động nhiều", multiplier: 1.725 },
  { value: "very_active", label: "Vận động rất nhiều", multiplier: 1.9 },
];

export const GOAL_OPTIONS: Array<{
  value: NutritionGoal;
  label: string;
  calorieDelta: number;
}> = [
  { value: "lose_weight", label: "Giảm cân", calorieDelta: -400 },
  { value: "maintain", label: "Duy trì", calorieDelta: 0 },
  { value: "gain_weight", label: "Tăng cân", calorieDelta: 350 },
  { value: "improve_health", label: "Cải thiện sức khỏe", calorieDelta: 0 },
];

export const GENDER_OPTIONS: Array<{ value: NutritionGender; label: string }> =
  [
    { value: "female", label: "Nữ" },
    { value: "male", label: "Nam" },
    { value: "other", label: "Khác" },
  ];

export interface NutritionCalculationInput {
  gender: NutritionGender;
  ageYears: number;
  heightCm: number;
  weightKg: number;
  activityLevel: NutritionActivityLevel;
  goal: NutritionGoal;
}

export interface NutritionCalculationResult {
  bmi: number;
  bmiCategory: string;
  bmr: number;
  tdee: number;
  targetCalories: number;
  proteinG: number;
  fatG: number;
  carbG: number;
  formulaVersion: string;
}

export function slugifyVietnamese(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 220);
}

export function normalizePhone(value: string): string {
  return value.replace(/\D/g, "");
}

export function calculateAgeFromBirthDate(
  birthDate?: string | null,
  now = new Date(),
): number | null {
  if (!birthDate) return null;
  const date = new Date(birthDate);
  if (Number.isNaN(date.getTime())) return null;

  let age = now.getFullYear() - date.getFullYear();
  const monthDiff = now.getMonth() - date.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && now.getDate() < date.getDate())) {
    age -= 1;
  }

  return Math.max(0, age);
}

export function getBmiCategory(bmi: number): string {
  if (bmi < 18.5) return "Thiếu cân";
  if (bmi < 23) return "Bình thường";
  if (bmi < 25) return "Thừa cân";
  if (bmi < 30) return "Béo phì độ I";
  return "Béo phì độ II trở lên";
}

export function calculateNutritionMetrics(
  input: NutritionCalculationInput,
): NutritionCalculationResult {
  const heightM = input.heightCm / 100;
  const bmi = input.weightKg / (heightM * heightM);
  const sexOffset = input.gender === "male" ? 5 : -161;
  const bmr =
    10 * input.weightKg + 6.25 * input.heightCm - 5 * input.ageYears + sexOffset;
  const activity =
    ACTIVITY_LEVEL_OPTIONS.find((item) => item.value === input.activityLevel) ||
    ACTIVITY_LEVEL_OPTIONS[1];
  const goal =
    GOAL_OPTIONS.find((item) => item.value === input.goal) || GOAL_OPTIONS[1];
  const tdee = bmr * activity.multiplier;
  const targetCalories = Math.max(900, tdee + goal.calorieDelta);
  const proteinG = Math.max(45, input.weightKg * 1.45);
  const fatCalories = targetCalories * 0.25;
  const fatG = fatCalories / 9;
  const carbG = Math.max(
    0,
    (targetCalories - proteinG * 4 - fatG * 9) / 4,
  );

  return {
    bmi: Math.round(bmi * 10) / 10,
    bmiCategory: getBmiCategory(bmi),
    bmr: Math.round(bmr),
    tdee: Math.round(tdee),
    targetCalories: Math.round(targetCalories),
    proteinG: Math.round(proteinG),
    fatG: Math.round(fatG),
    carbG: Math.round(carbG),
    formulaVersion: "mifflin-st-jeor-v1",
  };
}

export function getNutritionGoalLabel(value: NutritionGoal): string {
  return GOAL_OPTIONS.find((item) => item.value === value)?.label || value;
}

export function getActivityLevelLabel(value: NutritionActivityLevel): string {
  return (
    ACTIVITY_LEVEL_OPTIONS.find((item) => item.value === value)?.label || value
  );
}
