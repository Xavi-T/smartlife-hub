export type OrderStatus = "pending" | "processing" | "delivered" | "cancelled";

export interface Product {
  id: string;
  name: string;
  description: string | null;
  price: number;
  cost_price: number;
  stock_quantity: number;
  image_url: string | null;
  category: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Order {
  id: string;
  customer_name: string;
  customer_phone: string;
  customer_address: string;
  total_amount: number;
  status: OrderStatus;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface OrderItem {
  id: string;
  order_id: string;
  product_id: string;
  quantity: number;
  unit_price: number;
  subtotal: number;
  created_at: string;
}

export interface ProductSalesSummary {
  id: string;
  name: string;
  category: string;
  price: number;
  cost_price: number;
  total_orders: number;
  total_quantity_sold: number;
  total_revenue: number;
  total_cost: number;
  total_profit: number;
}

export interface DashboardStats {
  totalRevenue: number;
  totalProfit: number;
  monthlyOrders: number;
  lowStockProducts: number;
}

export interface Database {
  public: {
    Tables: {
      products: {
        Row: Product;
        Insert: Omit<Product, "id" | "created_at" | "updated_at">;
        Update: Partial<Omit<Product, "id" | "created_at" | "updated_at">>;
      };
      orders: {
        Row: Order;
        Insert: Omit<Order, "id" | "created_at" | "updated_at">;
        Update: Partial<Omit<Order, "id" | "created_at" | "updated_at">>;
      };
      order_items: {
        Row: OrderItem;
        Insert: Omit<OrderItem, "id" | "created_at">;
        Update: Partial<Omit<OrderItem, "id" | "created_at">>;
      };
    };
    Views: {
      product_sales_summary: {
        Row: ProductSalesSummary;
      };
    };
  };
}
