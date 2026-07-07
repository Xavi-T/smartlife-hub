import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import {
  getDisplayCustomerPhone,
  GUEST_CUSTOMER_NAME,
  isGuestPhone,
  normalizePhone,
} from "@/lib/customerIdentity";
import { matchesSearchText } from "@/lib/searchText";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";

function createAdminCustomersClient() {
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;

  if (!serviceRoleKey || !supabaseUrl) {
    return supabase;
  }

  return createClient<Database>(supabaseUrl, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

type CustomerOrderRow = {
  id: string;
  customer_name: string;
  customer_phone: string;
  total_amount: number;
  status: "pending" | "confirmed" | "shipping" | "completed" | "cancelled";
  created_at: string;
  [key: string]: unknown;
};

export async function GET(request: NextRequest) {
  try {
    const authClient = await createServerSupabaseClient();
    const {
      data: { user },
    } = await authClient.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const searchQuery = searchParams.get("search") || "";
    const customerType = searchParams.get("type") || "all";

    // Lấy tất cả đơn hàng
    const adminCustomersClient = createAdminCustomersClient();
    const { data: orders, error } = await adminCustomersClient
      .from("orders")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) throw error;

    const orderRows = (orders || []) as CustomerOrderRow[];

    // Gom nhóm theo SĐT thật. Khách không có SĐT dùng key theo từng đơn để
    // tránh gom nhầm vào một hồ sơ do số placeholder 000000...
    const customerMap = new Map<
      string,
      {
        key: string;
        lookupKey: string;
        identityType: "phone" | "guest";
        phone: string;
        rawPhone: string;
        name: string;
        totalOrders: number;
        totalSpent: number;
        deliveredOrders: number;
        lastOrderDate: string;
        firstOrderDate: string;
        orders: CustomerOrderRow[];
      }
    >();

    orderRows.forEach((order) => {
      const normalizedPhone = normalizePhone(order.customer_phone);
      const isGuest = isGuestPhone(normalizedPhone);
      const displayPhone = getDisplayCustomerPhone(order.customer_phone);
      const name = order.customer_name?.trim() || GUEST_CUSTOMER_NAME;
      const key = isGuest ? `order:${order.id}` : `phone:${normalizedPhone}`;
      const lookupKey = isGuest ? `order:${order.id}` : normalizedPhone;

      if (customerMap.has(key)) {
        const customer = customerMap.get(key)!;
        customer.totalOrders += 1;
        customer.orders.push(order);

        // Cập nhật tổng chi tiêu (chỉ đơn đã hoàn thành)
        if (order.status === "completed") {
          customer.totalSpent += order.total_amount;
          customer.deliveredOrders += 1;
        }

        // Cập nhật ngày đơn cuối
        if (new Date(order.created_at) > new Date(customer.lastOrderDate)) {
          customer.lastOrderDate = order.created_at;
        }

        // Cập nhật ngày đơn đầu
        if (new Date(order.created_at) < new Date(customer.firstOrderDate)) {
          customer.firstOrderDate = order.created_at;
        }
      } else {
        customerMap.set(key, {
          key,
          lookupKey,
          identityType: isGuest ? "guest" : "phone",
          phone: displayPhone,
          rawPhone: order.customer_phone,
          name,
          totalOrders: 1,
          totalSpent: order.status === "completed" ? order.total_amount : 0,
          deliveredOrders: order.status === "completed" ? 1 : 0,
          lastOrderDate: order.created_at,
          firstOrderDate: order.created_at,
          orders: [order],
        });
      }
    });

    // Chuyển sang array và phân loại
    let customers = Array.from(customerMap.values()).map((customer) => {
      // Phân loại khách hàng
      let customerType = "Khách mới";
      let typeColor = "yellow";

      if (customer.totalOrders >= 3) {
        customerType = "Khách thân thiết";
        typeColor = "purple";
      } else if (customer.totalOrders >= 2) {
        customerType = "Khách quen";
        typeColor = "blue";
      }

      return {
        ...customer,
        customerType,
        typeColor,
        averageOrderValue:
          customer.deliveredOrders > 0
            ? customer.totalSpent / customer.deliveredOrders
            : 0,
      };
    });

    // Lọc theo search
    if (searchQuery) {
      customers = customers.filter((customer) =>
        matchesSearchText(
          `${customer.name} ${customer.phone} ${customer.identityType === "guest" ? "khach le không có sdt" : ""}`,
          searchQuery,
        ),
      );
    }

    // Lọc theo loại khách hàng
    if (customerType !== "all") {
      customers = customers.filter((c) => {
        switch (customerType) {
          case "new":
            return c.totalOrders === 1;
          case "regular":
            return c.totalOrders === 2;
          case "loyal":
            return c.totalOrders >= 3;
          default:
            return true;
        }
      });
    }

    // Sắp xếp theo tổng chi tiêu giảm dần
    customers.sort((a, b) => b.totalSpent - a.totalSpent);

    // Thống kê tổng quan
    const stats = {
      totalCustomers: customers.length,
      newCustomers: customers.filter((c) => c.totalOrders === 1).length,
      regularCustomers: customers.filter((c) => c.totalOrders === 2).length,
      loyalCustomers: customers.filter((c) => c.totalOrders >= 3).length,
      totalRevenue: customers.reduce((sum, c) => sum + c.totalSpent, 0),
      averageLTV:
        customers.length > 0
          ? customers.reduce((sum, c) => sum + c.totalSpent, 0) /
            customers.length
          : 0,
    };

    return NextResponse.json({
      customers,
      stats,
    });
  } catch (error: unknown) {
    console.error("Error fetching customers:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Không thể tải danh sách khách hàng",
      },
      { status: 500 },
    );
  }
}
