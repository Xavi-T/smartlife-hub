"use server";

import { supabase } from "@/lib/supabase";
import { AuditLogger } from "@/lib/auditLogger";
import { createClient } from "@supabase/supabase-js";
import type {
  CreateOrderRequest,
  CreateOrderResponse,
  CartItem,
  CheckoutMethod,
  PaymentMethod,
} from "@/types/order";

interface ProductForOrder {
  id: string;
  name: string;
  price: number;
  discount_percent: number | null;
  stock_quantity: number;
  is_active: boolean;
}

function normalizePhone(phone: string): string {
  return phone.replace(/\D/g, "");
}

function createOrderWriteClient() {
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;

  if (!serviceRoleKey || !supabaseUrl) {
    return null;
  }

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  }) as any;
}

function calculateEffectivePrice(
  price: number,
  discountPercent: number | null,
): number {
  const discount = Math.min(Math.max(discountPercent || 0, 0), 100);
  return Math.round(price * (1 - discount / 100));
}

async function getCustomerSegmentDiscountPercent(
  db: any,
  customerPhone: string,
): Promise<{ segmentLabel: string | null; discountPercent: number }> {
  const { data: priorityCustomer } = await db
    .from("priority_customers")
    .select("customer_segment")
    .eq("customer_phone", customerPhone)
    .eq("is_active", true)
    .maybeSingle();

  if (!priorityCustomer?.customer_segment) {
    return { segmentLabel: null, discountPercent: 0 };
  }

  const { data: segment } = await db
    .from("customer_segment_settings")
    .select("segment_label, discount_percent")
    .eq("segment_key", priorityCustomer.customer_segment)
    .maybeSingle();

  const discountPercent = Math.min(
    100,
    Math.max(0, Number(segment?.discount_percent || 0)),
  );

  return {
    segmentLabel: segment?.segment_label || priorityCustomer.customer_segment,
    discountPercent,
  };
}

async function createOrderDirectly(params: {
  db: any;
  customerName: string;
  customerPhone: string;
  customerAddress: string;
  notes: string;
  checkoutMethod: CheckoutMethod;
  paymentMethod: PaymentMethod;
  items: CartItem[];
  customerDiscountPercent?: number;
}): Promise<CreateOrderResponse> {
  const {
    db,
    customerName,
    customerPhone,
    customerAddress,
    notes,
    checkoutMethod,
    paymentMethod,
    items,
    customerDiscountPercent = 0,
  } = params;

  if (!db) {
    return {
      success: false,
      message:
        "Thiếu SUPABASE_SERVICE_ROLE_KEY. Không thể tạo đơn hàng khi RLS đang bật.",
    };
  }

  const productIds = items.map((item) => item.product_id);
  const { data: productsData, error: productsError } = await db
    .from("products")
    .select("id, name, price, discount_percent, stock_quantity, is_active")
    .in("id", productIds);

  if (productsError) {
    return {
      success: false,
      message: "Không thể tải thông tin sản phẩm",
    };
  }

  const productRows = (productsData || []) as ProductForOrder[];
  const productMap = new Map(
    productRows.map((product: ProductForOrder) => [product.id, product]),
  );

  for (const item of items) {
    const product = productMap.get(item.product_id);
    if (!product) {
      return { success: false, message: "Sản phẩm không tồn tại" };
    }
    if (!product.is_active) {
      return {
        success: false,
        message: `Sản phẩm \"${product.name}\" đã ngừng bán`,
      };
    }
    if (product.stock_quantity < item.quantity) {
      return {
        success: false,
        message: `Sản phẩm \"${product.name}\" chỉ còn ${product.stock_quantity} sản phẩm`,
      };
    }
  }

  const baseOrderInsert = {
    customer_name: customerName,
    customer_phone: customerPhone,
    customer_address: customerAddress,
    total_amount: 0,
    status: "pending",
    notes,
  };

  const orderInsertWithPayment = {
    ...baseOrderInsert,
    checkout_method: checkoutMethod,
    payment_method: paymentMethod,
    payment_confirmed: paymentMethod === "cod",
    payment_confirmed_at:
      paymentMethod === "cod" ? new Date().toISOString() : null,
    payment_confirmed_by: paymentMethod === "cod" ? "system" : null,
  };

  let orderId: string | null = null;
  let orderInsertError: { code?: string; message?: string } | null = null;

  const { data: createdWithPayment, error: createWithPaymentError } = await db
    .from("orders")
    .insert(orderInsertWithPayment)
    .select("id")
    .single();

  if (!createWithPaymentError && createdWithPayment?.id) {
    orderId = createdWithPayment.id;
  } else {
    orderInsertError = createWithPaymentError as {
      code?: string;
      message?: string;
    };

    const { data: createdBase, error: createBaseError } = await db
      .from("orders")
      .insert(baseOrderInsert)
      .select("id")
      .single();

    if (createBaseError || !createdBase?.id) {
      return {
        success: false,
        message:
          "Không thể tạo đơn hàng" +
          (orderInsertError?.message ? `: ${orderInsertError.message}` : ""),
      };
    }

    orderId = createdBase.id;
  }

  const orderItemsPayload = items.map((item) => {
    const product = productMap.get(item.product_id)!;
    const baseUnitPrice = calculateEffectivePrice(
      product.price,
      product.discount_percent,
    );
    const safeCustomerDiscount = Math.min(
      100,
      Math.max(0, Number(customerDiscountPercent || 0)),
    );
    const unitPrice = Math.round(
      baseUnitPrice * (1 - safeCustomerDiscount / 100),
    );
    return {
      order_id: orderId,
      product_id: item.product_id,
      quantity: item.quantity,
      unit_price: unitPrice,
      subtotal: unitPrice * item.quantity,
    };
  });

  const { error: orderItemsError } = await db
    .from("order_items")
    .insert(orderItemsPayload);

  if (orderItemsError) {
    await db.from("orders").delete().eq("id", orderId);
    return {
      success: false,
      message: `Không thể tạo chi tiết đơn hàng: ${orderItemsError.message}`,
    };
  }

  const { data: finalOrder, error: finalOrderError } = await db
    .from("orders")
    .select("id, total_amount")
    .eq("id", orderId)
    .single();

  if (finalOrderError || !finalOrder) {
    return {
      success: false,
      message: "Không thể lấy thông tin đơn hàng sau khi tạo",
    };
  }

  return {
    success: true,
    orderId: finalOrder.id,
    totalAmount: Number(finalOrder.total_amount || 0),
    message: "Tạo đơn hàng thành công",
  };
}

/**
 * Server Action: Tạo đơn hàng mới
 *
 * Logic:
 * 1. Validate input
 * 2. Xác định % giảm theo phân loại khách hàng ưu tiên (qua SĐT)
 * 3. Tạo đơn hàng trực tiếp trong DB:
 *    - Kiểm tra tồn kho từng sản phẩm
 *    - Tạo order + order_items (đã áp giảm giá)
 *    - Trigger DB tự cập nhật (trừ) tồn kho
 */
export async function createOrder(
  request: CreateOrderRequest,
): Promise<CreateOrderResponse> {
  try {
    const orderWriteClient = createOrderWriteClient() as any;
    if (!orderWriteClient) {
      return {
        success: false,
        message:
          "Thiếu cấu hình máy chủ để tạo đơn hàng. Vui lòng liên hệ quản trị viên.",
      };
    }

    const checkoutMethod: CheckoutMethod = request.checkoutMethod || "cod";
    const paymentMethod: PaymentMethod =
      request.paymentMethod ||
      (checkoutMethod === "bank_transfer" ? "bank_transfer" : "cod");

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

    const normalizedPhone = normalizePhone(request.customer.phone);
    if (normalizedPhone.length < 10) {
      return {
        success: false,
        message: "Số điện thoại không hợp lệ",
      };
    }

    if (
      checkoutMethod === "bank_transfer" &&
      !request.customer.address?.trim()
    ) {
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

    const resolvedAddress = request.customer.address?.trim()
      ? request.customer.address.trim()
      : "Sẽ trao đổi khi tư vấn qua điện thoại";

    const extraNotes = [
      `Hình thức đặt hàng: ${
        checkoutMethod === "bank_transfer" ? "Chuyển khoản" : "Ship COD"
      }`,
      `Thanh toán: ${
        paymentMethod === "bank_transfer"
          ? "Chuyển khoản"
          : "Thanh toán khi nhận hàng (COD)"
      }`,
    ];

    if (request.customer.notes?.trim()) {
      extraNotes.unshift(request.customer.notes.trim());
    }

    const finalNotes = extraNotes.join("\n");

    const customerDiscountInfo = await getCustomerSegmentDiscountPercent(
      orderWriteClient,
      normalizedPhone,
    );

    const notesWithPriorityDiscount =
      customerDiscountInfo.discountPercent > 0
        ? `${finalNotes}\nGiảm theo phân loại khách hàng ưu tiên (${customerDiscountInfo.segmentLabel}): ${customerDiscountInfo.discountPercent}%`
        : finalNotes;

    const createResult = await createOrderDirectly({
      db: orderWriteClient,
      customerName: request.customer.name.trim(),
      customerPhone: normalizedPhone,
      customerAddress: resolvedAddress,
      notes: notesWithPriorityDiscount,
      checkoutMethod,
      paymentMethod,
      items: request.items,
      customerDiscountPercent: customerDiscountInfo.discountPercent,
    });

    if (!createResult.success || !createResult.orderId) {
      return createResult;
    }

    await AuditLogger.orderCreated(
      createResult.orderId,
      request.customer.name,
      createResult.totalAmount || 0,
      request.items.length,
    );

    return createResult;
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

    const { data: productsData, error } = await supabase
      .from("products")
      .select("id, name, stock_quantity, is_active")
      .in("id", productIds);

    const products = (productsData || []) as Array<{
      id: string;
      name: string;
      stock_quantity: number;
      is_active: boolean;
    }>;

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
    const orderReadClient = createOrderWriteClient() || supabase;
    const { data: order, error: orderError } = await orderReadClient
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

export async function getOrdersByPhone(phone: string) {
  try {
    const normalizedPhone = normalizePhone(phone);

    if (normalizedPhone.length < 10) {
      return {
        success: false,
        message: "Số điện thoại không hợp lệ",
      };
    }

    const orderReadClient = createOrderWriteClient() || supabase;
    const { data: orders, error } = await orderReadClient
      .from("orders")
      .select(
        `
        id,
        customer_name,
        customer_phone,
        customer_address,
        total_amount,
        status,
        checkout_method,
        payment_method,
        payment_confirmed,
        payment_confirmed_at,
        notes,
        created_at,
        order_items (
          id,
          quantity,
          unit_price,
          subtotal,
          products (
            name,
            image_url
          )
        )
      `,
      )
      .or(
        `customer_phone.eq.${normalizedPhone},customer_phone.eq.${phone.trim()}`,
      )
      .order("created_at", { ascending: false })
      .limit(20);

    if (error) throw error;

    return {
      success: true,
      data: orders || [],
    };
  } catch (error) {
    console.error("Error getting orders by phone:", error);
    return {
      success: false,
      message: "Không thể tra cứu đơn hàng",
    };
  }
}
