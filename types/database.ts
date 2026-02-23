export type OrderStatus = "pending" | "processing" | "delivered" | "cancelled";

export interface ProductRow {
  id: string;
  name: string;
  description: string | null;
  price: number;
  discount_percent: number | null;
  cost_price: number;
  stock_quantity: number;
  image_url: string | null;
  category: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Product extends ProductRow {
  categories?: Category[];
}

export interface Category {
  id: string;
  name: string;
  slug: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface ProductCategory {
  id: string;
  product_id: string;
  category_id: string;
  created_at: string;
}

export interface Order {
  id: string;
  customer_name: string;
  customer_phone: string;
  customer_address: string;
  total_amount: number;
  status: OrderStatus;
  checkout_method?: "cod" | "bank_transfer";
  payment_method?: "cod" | "bank_transfer";
  payment_confirmed?: boolean;
  payment_confirmed_at?: string | null;
  payment_confirmed_by?: string | null;
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

export interface CustomerSegmentSetting {
  id: string;
  segment_key: string;
  segment_label: string;
  min_delivered_orders: number;
  min_total_spent: number;
  discount_percent: number;
  is_priority: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface PriorityCustomer {
  id: string;
  customer_phone: string;
  customer_name: string;
  customer_segment: string;
  discount_percent: number;
  total_orders_snapshot: number;
  delivered_orders_snapshot: number;
  total_spent_snapshot: number;
  source: string;
  notes: string | null;
  is_active: boolean;
  last_order_at: string | null;
  created_at: string;
  updated_at: string;
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
        Row: ProductRow;
        Insert: Omit<ProductRow, "id" | "created_at" | "updated_at">;
        Update: Partial<Omit<ProductRow, "id" | "created_at" | "updated_at">>;
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
      categories: {
        Row: Category;
        Insert: Omit<Category, "id" | "created_at" | "updated_at">;
        Update: Partial<Omit<Category, "id" | "created_at" | "updated_at">>;
      };
      product_categories: {
        Row: ProductCategory;
        Insert: Omit<ProductCategory, "id" | "created_at">;
        Update: Partial<Omit<ProductCategory, "id" | "created_at">>;
      };
      customer_segment_settings: {
        Row: CustomerSegmentSetting;
        Insert: Omit<
          CustomerSegmentSetting,
          "id" | "created_at" | "updated_at"
        >;
        Update: Partial<
          Omit<CustomerSegmentSetting, "id" | "created_at" | "updated_at">
        >;
      };
      priority_customers: {
        Row: PriorityCustomer;
        Insert: Omit<PriorityCustomer, "id" | "created_at" | "updated_at">;
        Update: Partial<
          Omit<PriorityCustomer, "id" | "created_at" | "updated_at">
        >;
      };
    };
    Views: {
      product_sales_summary: {
        Row: ProductSalesSummary;
      };
    };
  };
}
