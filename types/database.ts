export type OrderStatus = "pending" | "processing" | "delivered" | "cancelled";
export type NutritionArticleStatus = "draft" | "published" | "archived";
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
export type NutritionClientStatus = "new" | "active" | "paused" | "completed";

export interface ProductRow {
  id: string;
  name: string;
  description: string | null;
  price: number;
  discount_percent: number | null;
  discount_start_at: string | null;
  discount_end_at: string | null;
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
  variants?: ProductVariant[];
}

export interface ProductVariant {
  id: string;
  product_id: string;
  variant_name: string;
  cost_price: number;
  price: number;
  image_url: string | null;
  sort_order: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
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

export interface NutritionCategory {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface NutritionArticle {
  id: string;
  title: string;
  slug: string;
  excerpt: string | null;
  content: string;
  cover_image_url: string | null;
  category_id: string | null;
  author_name: string | null;
  status: NutritionArticleStatus;
  related_product_ids: string[];
  published_at: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface NutritionClient {
  id: string;
  full_name: string;
  phone: string;
  gender: NutritionGender;
  birth_date: string | null;
  height_cm: number | null;
  weight_kg: number | null;
  activity_level: NutritionActivityLevel;
  goal: NutritionGoal;
  medical_notes: string | null;
  allergies: string | null;
  doctor_notes: string | null;
  status: NutritionClientStatus;
  consent_given: boolean;
  consent_at: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface NutritionAssessment {
  id: string;
  client_id: string;
  assessed_at: string;
  age_years: number | null;
  gender: NutritionGender;
  height_cm: number;
  weight_kg: number;
  activity_level: NutritionActivityLevel;
  goal: NutritionGoal;
  bmi: number;
  bmi_category: string;
  bmr: number;
  tdee: number;
  target_calories: number;
  protein_g: number;
  fat_g: number;
  carb_g: number;
  doctor_notes: string | null;
  recommendation_text: string | null;
  related_product_ids: string[];
  formula_version: string;
  created_by: string | null;
  created_at: string;
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
        Relationships: [];
      };
      orders: {
        Row: Order;
        Insert: Omit<Order, "id" | "created_at" | "updated_at">;
        Update: Partial<Omit<Order, "id" | "created_at" | "updated_at">>;
        Relationships: [];
      };
      order_items: {
        Row: OrderItem;
        Insert: Omit<OrderItem, "id" | "created_at">;
        Update: Partial<Omit<OrderItem, "id" | "created_at">>;
        Relationships: [];
      };
      categories: {
        Row: Category;
        Insert: Omit<Category, "id" | "created_at" | "updated_at">;
        Update: Partial<Omit<Category, "id" | "created_at" | "updated_at">>;
        Relationships: [];
      };
      product_categories: {
        Row: ProductCategory;
        Insert: Omit<ProductCategory, "id" | "created_at">;
        Update: Partial<Omit<ProductCategory, "id" | "created_at">>;
        Relationships: [];
      };
      product_variants: {
        Row: ProductVariant;
        Insert: Omit<ProductVariant, "id" | "created_at" | "updated_at">;
        Update: Partial<Omit<ProductVariant, "id" | "created_at" | "updated_at">>;
        Relationships: [];
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
        Relationships: [];
      };
      priority_customers: {
        Row: PriorityCustomer;
        Insert: Omit<PriorityCustomer, "id" | "created_at" | "updated_at">;
        Update: Partial<
          Omit<PriorityCustomer, "id" | "created_at" | "updated_at">
        >;
        Relationships: [];
      };
      nutrition_categories: {
        Row: NutritionCategory;
        Insert: Omit<NutritionCategory, "id" | "created_at" | "updated_at">;
        Update: Partial<
          Omit<NutritionCategory, "id" | "created_at" | "updated_at">
        >;
        Relationships: [];
      };
      nutrition_articles: {
        Row: NutritionArticle;
        Insert: Omit<NutritionArticle, "id" | "created_at" | "updated_at">;
        Update: Partial<
          Omit<NutritionArticle, "id" | "created_at" | "updated_at">
        >;
        Relationships: [];
      };
      nutrition_clients: {
        Row: NutritionClient;
        Insert: Omit<NutritionClient, "id" | "created_at" | "updated_at">;
        Update: Partial<
          Omit<NutritionClient, "id" | "created_at" | "updated_at">
        >;
        Relationships: [];
      };
      nutrition_assessments: {
        Row: NutritionAssessment;
        Insert: Omit<NutritionAssessment, "id" | "created_at">;
        Update: Partial<Omit<NutritionAssessment, "id" | "created_at">>;
        Relationships: [];
      };
    };
    Views: {
      product_sales_summary: {
        Row: ProductSalesSummary;
        Relationships: [];
      };
    };
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
}
