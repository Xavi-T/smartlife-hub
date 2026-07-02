export type RevenueThresholdStatus =
  | "safe"
  | "attention"
  | "warning"
  | "exceeded";

export interface TaxComplianceSettings {
  annualRevenueThreshold: number;
  warningLevels: [number, number, number];
  currentBookCode: string;
  notes: string;
}

export interface MonthlyRevenue {
  month: number;
  amount: number;
  orderCount: number;
}

export interface TaxReadinessOverview {
  year: number;
  settings: TaxComplianceSettings;
  revenue: {
    completedOrders: number;
    completedOrderCount: number;
    manualTaxableIncome: number;
    total: number;
    remaining: number;
    percentage: number;
    status: RevenueThresholdStatus;
  };
  monthlyRevenue: MonthlyRevenue[];
}

export type FinancialTransactionType = "income" | "expense";
export type FinancialPaymentChannel = "cash" | "bank";

export interface FinancialTransaction {
  id: string;
  transactionType: FinancialTransactionType;
  paymentChannel: FinancialPaymentChannel;
  occurredAt: string;
  documentNumber: string;
  category: string;
  description: string;
  amount: number;
  counterparty: string;
  affectsTaxRevenue: boolean;
  notes: string;
  createdAt: string;
  updatedAt: string;
}

export interface ProductTaxProfile {
  productId: string;
  productName: string;
  sku: string;
  taxGroupName: string;
  businessActivity: string;
  vatRatePercent: number | null;
  pitRatePercent: number | null;
  notes: string;
  isConfigured: boolean;
}
