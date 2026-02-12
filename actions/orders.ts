"use server";

import { supabase } from "@/lib/supabase";
import { AuditLogger } from "@/lib/auditLogger";
import type {
  CreateOrderRequest,
  CreateOrderResponse,
  CartItem,
} from "@/types/order";

/**
 * Server Action: Tạo đơn hàng mới
 *
 * Logic:
 * 1. Validate input
 * 2. Gọi PostgreSQL function để xử lý transaction
 * 3. Function sẽ:
 *    - Kiểm tra tồn kho từng sản phẩm
 *    - Tạo order
 *    - Tạo order_items
 *    - Cập nhật (trừ) tồn kho
 * 4. Tất cả trong một transaction - rollback nếu có lỗi
 */
export async function createOrder(
  request: CreateOrderRequest,
): Promise<CreateOrderResponse> {
  try {
    // Validate input
    if (!request.customer.name?.trim()) {
      return {
        success: false,
        message: "Vui lòng nhập tên khách hàng",
      };
    }

    if (!request.customer.phone?.trim()) {
      return {
        success: false,
        message: "Vui lòng nhập số điện thoại",
      };
    }

    if (request.customer.phone.length < 10) {
      return {
        success: false,
        message: "Số điện thoại không hợp lệ",
      };
    }

    if (!request.customer.address?.trim()) {
      return {
        success: false,
        message: "Vui lòng nhập địa chỉ giao hàng",
      };
    }

    if (!request.items || request.items.length === 0) {
      return {
        success: false,
        message: "Giỏ hàng trống",
      };
    }

    // Validate items
    for (const item of request.items) {
      if (!item.product_id) {
        return {
          success: false,
          message: "ID sản phẩm không hợp lệ",
        };
      }

      if (!item.quantity || item.quantity <= 0) {
        return {
          success: false,
          message: "Số lượng phải lớn hơn 0",
        };
      }
    }

    // Gọi PostgreSQL function để xử lý transaction
    const { data, error } = await supabase.rpc("create_order_transaction", {
      p_customer_name: request.customer.name.trim(),
      p_customer_phone: request.customer.phone.trim(),
      p_customer_address: request.customer.address.trim(),
      p_notes: request.customer.notes?.trim() || null,
      p_items: JSON.stringify(request.items),
    });

    if (error) {
      console.error("Database error:", error);
      return {
        success: false,
        message: "Lỗi khi tạo đơn hàng: " + error.message,
      };
    }

    // Parse response từ function
    const result = data?.[0];

    if (!result || !result.success) {
      return {
        success: false,
        message: result?.message || "Không thể tạo đơn hàng",
      };
    }

    // Log audit event
    await AuditLogger.orderCreated(
      result.order_id,
      request.customer.name,
      parseFloat(result.total_amount),
      request.items.length,
    );

    return {
      success: true,
      orderId: result.order_id,
      totalAmount: parseFloat(result.total_amount),
      message: result.message,
    };
  } catch (error) {
    console.error("Error in createOrder:", error);
    return {
      success: false,
      message: "Đã xảy ra lỗi không mong muốn",
    };
  }
}

/**
 * Server Action: Kiểm tra tồn kho trước khi đặt hàng
 * Helper function để check stock trước khi submit
 */
export async function checkStockAvailability(
  items: CartItem[],
): Promise<{ available: boolean; message?: string }> {
  try {
    const productIds = items.map((item) => item.product_id);

    const { data: products, error } = await supabase
      .from("products")
      .select("id, name, stock_quantity, is_active")
      .in("id", productIds);

    if (error) {
      return {
        available: false,
        message: "Không thể kiểm tra tồn kho",
      };
    }

    // Kiểm tra từng sản phẩm
    for (const item of items) {
      const product = products?.find((p) => p.id === item.product_id);

      if (!product) {
        return {
          available: false,
          message: "Sản phẩm không tồn tại",
        };
      }

      if (!product.is_active) {
        return {
          available: false,
          message: `Sản phẩm "${product.name}" đã ngừng bán`,
        };
      }

      if (product.stock_quantity < item.quantity) {
        return {
          available: false,
          message: `Sản phẩm "${product.name}" chỉ còn ${product.stock_quantity} sản phẩm`,
        };
      }
    }

    return { available: true };
  } catch (error) {
    console.error("Error checking stock:", error);
    return {
      available: false,
      message: "Lỗi khi kiểm tra tồn kho",
    };
  }
}

/**
 * Server Action: Lấy thông tin chi tiết đơn hàng
 */
export async function getOrderDetails(orderId: string) {
  try {
    const { data: order, error: orderError } = await supabase
      .from("orders")
      .select(
        `
        *,
        order_items (
          *,
          products (
            name,
            image_url
          )
        )
      `,
      )
      .eq("id", orderId)
      .single();

    if (orderError) {
      throw orderError;
    }

    return {
      success: true,
      data: order,
    };
  } catch (error) {
    console.error("Error getting order details:", error);
    return {
      success: false,
      message: "Không thể lấy thông tin đơn hàng",
    };
  }
}
