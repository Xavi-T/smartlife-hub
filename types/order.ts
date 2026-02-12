export interface CartItem {
  product_id: string;
  quantity: number;
}

export interface CustomerInfo {
  name: string;
  phone: string;
  address: string;
  notes?: string;
}

export interface CreateOrderRequest {
  customer: CustomerInfo;
  items: CartItem[];
}

export interface CreateOrderResponse {
  success: boolean;
  orderId?: string;
  totalAmount?: number;
  message: string;
}
