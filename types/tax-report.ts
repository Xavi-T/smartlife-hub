export type S1aHkdDescriptionMode =
  | "order_and_products"
  | "products"
  | "order";

export interface S1aHkdEntry {
  orderId: string;
  orderCode: string;
  completedAt: string;
  productSummary: string;
  amount: number;
}

export interface S1aHkdSummary {
  orderCount: number;
  totalAmount: number;
  from: string;
  to: string;
}

export interface S1aHkdReportResponse {
  entries: S1aHkdEntry[];
  summary: S1aHkdSummary;
}

export interface S1aHkdBusinessInfo {
  householdName: string;
  address: string;
  taxCode: string;
  businessLocation: string;
  declarationPeriod: string;
  unit: string;
  representativeName: string;
  signingLocation: string;
}

export function getS1aHkdDescription(
  entry: S1aHkdEntry,
  mode: S1aHkdDescriptionMode,
): string {
  if (mode === "order") {
    return `Đơn hàng #${entry.orderCode}`;
  }
  if (mode === "products") {
    return entry.productSummary;
  }
  return `Đơn hàng #${entry.orderCode} – ${entry.productSummary}`;
}
