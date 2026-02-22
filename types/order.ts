export interface CartItem {
  product_id: string;
  quantity: number;
}

export interface CustomerInfo {
  name: string;
  phone: string;
  address?: string;
  notes?: string;
}

export type CheckoutMethod = "cod" | "bank_transfer";

export type PaymentMethod = "cod" | "bank_transfer";

export interface CreateOrderRequest {
  customer: CustomerInfo;
  items: CartItem[];
  checkoutMethod?: CheckoutMethod;
  paymentMethod?: PaymentMethod;
}

export interface CreateOrderResponse {
  success: boolean;
  orderId?: string;
  totalAmount?: number;
  message: string;
}
