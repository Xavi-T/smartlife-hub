export type ClinicalNutritionUnit = "ml" | "g";

export interface ClinicalNutritionProduct {
  id: string;
  name: string;
  unit: ClinicalNutritionUnit;
  proteinPer100: number;
  lipidPer100: number;
  glucosePer100: number;
  energyPer100: number;
  note?: string;
}

export interface ClinicalNutritionLineInput {
  id: string;
  productId: string;
  quantity: number;
  amount: number;
  note?: string;
}

export interface ClinicalNutritionLineResult extends ClinicalNutritionLineInput {
  product: ClinicalNutritionProduct | null;
  unit: ClinicalNutritionUnit | "";
  totalAmount: number;
  proteinG: number;
  lipidG: number;
  glucoseG: number;
  energyKcal: number;
}

export interface ClinicalNutritionTotals {
  totalLiquidMl: number;
  totalPowderG: number;
  proteinG: number;
  lipidG: number;
  glucoseG: number;
  energyKcal: number;
  proteinEnergyPercent: number;
  lipidEnergyPercent: number;
  glucoseEnergyPercent: number;
  macroEnergyKcal: number;
  nitrogenG: number;
  nonProteinEnergyKcal: number;
  nonProteinEnergyNitrogenRatio: number;
  energyDensityKcalPerMl: number;
}

export interface ClinicalNutritionPlanResult {
  lines: ClinicalNutritionLineResult[];
  totals: ClinicalNutritionTotals;
}

export const CLINICAL_NUTRITION_PRODUCTS: ClinicalNutritionProduct[] = [];

export const DEFAULT_CLINICAL_NUTRITION_LINES: ClinicalNutritionLineInput[] = [];

export function roundNutritionValue(value: number, precision = 2): number {
  const factor = 10 ** precision;
  return Math.round((value + Number.EPSILON) * factor) / factor;
}

export function findClinicalNutritionProduct(
  productId: string,
  products: ClinicalNutritionProduct[] = [],
): ClinicalNutritionProduct | null {
  return (
    products.find((product) => product.id === productId) || null
  );
}

export function calculateClinicalNutritionLine(
  line: ClinicalNutritionLineInput,
  products?: ClinicalNutritionProduct[],
): ClinicalNutritionLineResult {
  const product = findClinicalNutritionProduct(line.productId, products);
  const quantity = Number.isFinite(line.quantity) ? line.quantity : 0;
  const amount = Number.isFinite(line.amount) ? line.amount : 0;
  const totalAmount = Math.max(0, quantity) * Math.max(0, amount);

  if (!product) {
    return {
      ...line,
      quantity,
      amount,
      product: null,
      unit: "",
      totalAmount,
      proteinG: 0,
      lipidG: 0,
      glucoseG: 0,
      energyKcal: 0,
    };
  }

  return {
    ...line,
    quantity,
    amount,
    product,
    unit: product.unit,
    totalAmount,
    proteinG: (product.proteinPer100 * totalAmount) / 100,
    lipidG: (product.lipidPer100 * totalAmount) / 100,
    glucoseG: (product.glucosePer100 * totalAmount) / 100,
    energyKcal: (product.energyPer100 * totalAmount) / 100,
  };
}

export function calculateClinicalNutritionPlan(
  lines: ClinicalNutritionLineInput[],
  products?: ClinicalNutritionProduct[],
): ClinicalNutritionPlanResult {
  const calculatedLines = lines.map((line) =>
    calculateClinicalNutritionLine(line, products),
  );
  const totals = calculatedLines.reduce(
    (summary, line) => ({
      totalLiquidMl:
        summary.totalLiquidMl + (line.unit === "ml" ? line.totalAmount : 0),
      totalPowderG:
        summary.totalPowderG + (line.unit === "g" ? line.totalAmount : 0),
      proteinG: summary.proteinG + line.proteinG,
      lipidG: summary.lipidG + line.lipidG,
      glucoseG: summary.glucoseG + line.glucoseG,
      energyKcal: summary.energyKcal + line.energyKcal,
      proteinEnergyPercent: 0,
      lipidEnergyPercent: 0,
      glucoseEnergyPercent: 0,
      macroEnergyKcal: 0,
      nitrogenG: 0,
      nonProteinEnergyKcal: 0,
      nonProteinEnergyNitrogenRatio: 0,
      energyDensityKcalPerMl: 0,
    }),
    {
      totalLiquidMl: 0,
      totalPowderG: 0,
      proteinG: 0,
      lipidG: 0,
      glucoseG: 0,
      energyKcal: 0,
      proteinEnergyPercent: 0,
      lipidEnergyPercent: 0,
      glucoseEnergyPercent: 0,
      macroEnergyKcal: 0,
      nitrogenG: 0,
      nonProteinEnergyKcal: 0,
      nonProteinEnergyNitrogenRatio: 0,
      energyDensityKcalPerMl: 0,
    },
  );

  const macroEnergyKcal =
    totals.proteinG * 4 + totals.lipidG * 9 + totals.glucoseG * 4;
  const energyDenominator = totals.energyKcal > 0 ? totals.energyKcal : 0;
  const nitrogenG = totals.proteinG / 6.25;
  const nonProteinEnergyKcal = Math.max(0, totals.energyKcal - totals.proteinG * 4);

  return {
    lines: calculatedLines,
    totals: {
      ...totals,
      macroEnergyKcal,
      nitrogenG,
      nonProteinEnergyKcal,
      nonProteinEnergyNitrogenRatio: nitrogenG
        ? nonProteinEnergyKcal / nitrogenG
        : 0,
      energyDensityKcalPerMl: totals.totalLiquidMl
        ? totals.energyKcal / totals.totalLiquidMl
        : 0,
      proteinEnergyPercent: energyDenominator
        ? (totals.proteinG * 4 * 100) / energyDenominator
        : 0,
      lipidEnergyPercent: energyDenominator
        ? (totals.lipidG * 9 * 100) / energyDenominator
        : 0,
      glucoseEnergyPercent: energyDenominator
        ? (totals.glucoseG * 4 * 100) / energyDenominator
        : 0,
    },
  };
}

export function formatClinicalNutritionNumber(
  value: number,
  precision = 2,
): string {
  return new Intl.NumberFormat("vi-VN", {
    minimumFractionDigits: precision,
    maximumFractionDigits: precision,
  }).format(roundNutritionValue(value, precision));
}
