import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const searchQuery = searchParams.get("search") || "";
    const customerType = searchParams.get("type") || "all";

    // Lấy tất cả đơn hàng
    const { data: orders, error } = await supabase
      .from("orders")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) throw error;

    // Gom nhóm theo số điện thoại
    const customerMap = new Map<
      string,
      {
        phone: string;
        name: string;
        totalOrders: number;
        totalSpent: number;
        deliveredOrders: number;
        lastOrderDate: string;
        firstOrderDate: string;
        orders: any[];
      }
    >();

    orders.forEach((order) => {
      const phone = order.customer_phone;

      if (customerMap.has(phone)) {
        const customer = customerMap.get(phone)!;
        customer.totalOrders += 1;
        customer.orders.push(order);

        // Cập nhật tổng chi tiêu (chỉ đơn đã giao)
        if (order.status === "delivered") {
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
        customerMap.set(phone, {
          phone,
          name: order.customer_name,
          totalOrders: 1,
          totalSpent: order.status === "delivered" ? order.total_amount : 0,
          deliveredOrders: order.status === "delivered" ? 1 : 0,
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
      const query = searchQuery.toLowerCase();
      customers = customers.filter(
        (c) => c.name.toLowerCase().includes(query) || c.phone.includes(query),
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
      totalCustomers: customerMap.size,
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
  } catch (error: any) {
    console.error("Error fetching customers:", error);
    return NextResponse.json(
      { error: error.message || "Không thể tải danh sách khách hàng" },
      { status: 500 },
    );
  }
}
