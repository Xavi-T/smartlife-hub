export interface CartItem {
  product_id: string;
  quantity: number;
  variant_id?: string;
}

export interface CustomerInfo {
  name: string;
  phone: string;
  address?: string;
  notes?: string;
}

export type CheckoutMethod = "cod" | "bank_transfer";

export type PaymentMethod = "cod" | "bank_transfer";

export type ManualDiscountValueType = "percent" | "amount";

export interface ManualProductDiscount {
  productId: string;
  valueType?: ManualDiscountValueType;
  percent?: number;
  amount?: number;
}

export interface CreateOrderRequest {
  customer: CustomerInfo;
  items: CartItem[];
  checkoutMethod?: CheckoutMethod;
  paymentMethod?: PaymentMethod;
  isCounterSale?: boolean;
  manualDiscountPercent?: number;
  manualDiscountValueType?: ManualDiscountValueType;
  manualDiscountAmount?: number;
  manualDiscountMode?: "order_total" | "product_items";
  manualProductDiscounts?: ManualProductDiscount[];
}

export interface CreateOrderResponse {
  success: boolean;
  orderId?: string;
  totalAmount?: number;
  message: string;
}
