"use server";

import { supabase } from "@/lib/supabase";
import { AuditLogger } from "@/lib/auditLogger";
import { sendOrderNotificationEmail } from "@/lib/emailNotifications";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import {
  createGuestCustomerPhone,
  GUEST_CUSTOMER_NAME,
  isGuestPhone,
  normalizePhone,
} from "@/lib/customerIdentity";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import {
  awardPointsForOrder,
  consumeVoucherForOrder,
  previewVoucherDiscount,
} from "@/lib/loyalty";
import type {
  CreateOrderRequest,
  CreateOrderResponse,
  CartItem,
  CheckoutMethod,
  ManualDiscountValueType,
  ManualProductDiscount,
  PaymentMethod,
} from "@/types/order";

type SupabaseAdminClient = ReturnType<typeof createClient<Database>>;
type SupabaseMutationError = { code?: string; message?: string };
type OrdersMutationTable = {
  insert(payload: unknown): {
    select(columns: string): {
      single(): PromiseLike<{
        data: { id: string; total_amount?: number } | null;
        error: SupabaseMutationError | null;
      }>;
    };
  };
  update(payload: unknown): {
    eq(
      column: string,
      value: string,
    ): PromiseLike<{ error: SupabaseMutationError | null }>;
  };
  delete(): {
    eq(
      column: string,
      value: string,
    ): PromiseLike<{ error: SupabaseMutationError | null }>;
  };
  select(columns: string): {
    eq(
      column: string,
      value: string,
    ): {
      single(): PromiseLike<{
        data: { id: string; total_amount: number } | null;
        error: SupabaseMutationError | null;
      }>;
    };
  };
};
type OrderItemsMutationTable = {
  insert(payload: unknown): PromiseLike<{
    error: SupabaseMutationError | null;
  }>;
};
type OrderMutationClient = {
  from(table: "orders"): OrdersMutationTable;
  from(table: "order_items"): OrderItemsMutationTable;
};

interface ProductForOrder {
  id: string;
  name: string;
  price: number;
  discount_percent: number | null;
  category: string;
  stock_quantity: number;
  is_active: boolean;
}

interface ProductVariantForOrder {
  id: string;
  product_id: string;
  variant_name: string;
  price: number;
  is_active: boolean;
}

interface PreparedOrderLine {
  productId: string;
  quantity: number;
  baseUnitPrice: number;
}

interface OrderItemInsertPayload {
  order_id: string | null;
  product_id: string;
  quantity: number;
  unit_price: number;
  subtotal: number;
}

interface NormalizedManualProductDiscount {
  productId: string;
  valueType: ManualDiscountValueType;
  percent: number;
  amount: number;
}

function createOrderWriteClient() {
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;

  if (!serviceRoleKey || !supabaseUrl) {
    return null;
  }

  return createClient<Database>(supabaseUrl, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

function calculateEffectivePrice(
  price: number,
  discountPercent: number | null,
): number {
  const discount = Math.min(Math.max(discountPercent || 0, 0), 100);
  return Math.round(price * (1 - discount / 100));
}

function normalizePercent(value: unknown): number {
  return Math.min(100, Math.max(0, Number(value || 0)));
}

function normalizeMoneyAmount(value: unknown): number {
  return Math.max(0, Math.round(Number(value || 0)));
}

function normalizeManualDiscountValueType(
  value: unknown,
): ManualDiscountValueType {
  return value === "amount" ? "amount" : "percent";
}

function allocateDiscountAcrossUnits(
  requestedDiscountAmount: number,
  unitPrices: number[],
): number[] {
  const totalBeforeDiscount = unitPrices.reduce((sum, price) => sum + price, 0);
  const totalDiscount = Math.min(
    normalizeMoneyAmount(requestedDiscountAmount),
    totalBeforeDiscount,
  );

  if (totalDiscount <= 0 || totalBeforeDiscount <= 0) {
    return unitPrices.map(() => 0);
  }

  const rawAllocations = unitPrices.map((price, index) => {
    const rawAmount = (totalDiscount * price) / totalBeforeDiscount;
    const amount = Math.min(price, Math.floor(rawAmount));

    return {
      index,
      amount,
      remainder: rawAmount - amount,
      price,
    };
  });

  let remaining =
    totalDiscount - rawAllocations.reduce((sum, item) => sum + item.amount, 0);
  const sortedByRemainder = [...rawAllocations].sort((first, second) => {
    if (second.remainder !== first.remainder) {
      return second.remainder - first.remainder;
    }

    return second.price - first.price;
  });

  while (remaining > 0) {
    let changed = false;

    for (const item of sortedByRemainder) {
      if (remaining <= 0) break;
      if (item.amount >= item.price) continue;

      item.amount += 1;
      remaining -= 1;
      changed = true;
    }

    if (!changed) break;
  }

  const allocations = unitPrices.map(() => 0);
  sortedByRemainder.forEach((item) => {
    allocations[item.index] = item.amount;
  });

  return allocations;
}

function buildAmountDiscountOrderItems(
  orderId: string | null,
  lines: PreparedOrderLine[],
  discountAmount: number,
): OrderItemInsertPayload[] {
  const unitEntries = lines.flatMap((line) =>
    Array.from({ length: line.quantity }, () => ({
      productId: line.productId,
      unitPrice: line.baseUnitPrice,
    })),
  );
  const unitDiscounts = allocateDiscountAcrossUnits(
    discountAmount,
    unitEntries.map((entry) => entry.unitPrice),
  );
  const groupedItems = new Map<string, OrderItemInsertPayload>();

  unitEntries.forEach((entry, index) => {
    const finalUnitPrice = Math.max(
      0,
      entry.unitPrice - (unitDiscounts[index] || 0),
    );
    const groupKey = `${entry.productId}:${finalUnitPrice}`;
    const existing = groupedItems.get(groupKey);

    if (existing) {
      existing.quantity += 1;
      existing.subtotal = existing.unit_price * existing.quantity;
      return;
    }

    groupedItems.set(groupKey, {
      order_id: orderId,
      product_id: entry.productId,
      quantity: 1,
      unit_price: finalUnitPrice,
      subtotal: finalUnitPrice,
    });
  });

  return Array.from(groupedItems.values());
}

function buildPercentDiscountOrderItem(
  orderId: string | null,
  line: PreparedOrderLine,
  percent: number,
): OrderItemInsertPayload {
  const unitPrice = Math.round(line.baseUnitPrice * (1 - percent / 100));

  return {
    order_id: orderId,
    product_id: line.productId,
    quantity: line.quantity,
    unit_price: unitPrice,
    subtotal: unitPrice * line.quantity,
  };
}

function buildProductDiscountOrderItems(
  orderId: string | null,
  lines: PreparedOrderLine[],
  discounts: Map<string, NormalizedManualProductDiscount>,
): OrderItemInsertPayload[] {
  const percentDiscountItems: OrderItemInsertPayload[] = [];
  const amountDiscountLines = new Map<string, PreparedOrderLine[]>();

  lines.forEach((line) => {
    const discount = discounts.get(line.productId);

    if (discount?.valueType === "amount") {
      const currentLines = amountDiscountLines.get(line.productId) || [];
      currentLines.push(line);
      amountDiscountLines.set(line.productId, currentLines);
      return;
    }

    percentDiscountItems.push(
      buildPercentDiscountOrderItem(orderId, line, discount?.percent || 0),
    );
  });

  const amountDiscountItems = Array.from(amountDiscountLines.entries()).flatMap(
    ([productId, productLines]) =>
      buildAmountDiscountOrderItems(
        orderId,
        productLines,
        discounts.get(productId)?.amount || 0,
      ),
  );

  return [...percentDiscountItems, ...amountDiscountItems];
}

function calculateOrderGrossAmount(lines: PreparedOrderLine[]): number {
  return lines.reduce(
    (sum, line) => sum + line.baseUnitPrice * line.quantity,
    0,
  );
}

function calculateOrderFinalAmount(
  orderItems: OrderItemInsertPayload[],
): number {
  return orderItems.reduce(
    (sum, item) => sum + normalizeMoneyAmount(item.subtotal),
    0,
  );
}

function buildDiscountLabel(params: {
  manualDiscountMode: "order_total" | "product_items";
  manualDiscountValueType: ManualDiscountValueType;
  manualDiscountPercent: number;
  manualDiscountAmount: number;
  positiveProductDiscountCount: number;
}): string | null {
  const {
    manualDiscountMode,
    manualDiscountValueType,
    manualDiscountPercent,
    manualDiscountAmount,
    positiveProductDiscountCount,
  } = params;

  if (manualDiscountMode === "product_items") {
    return positiveProductDiscountCount > 0
      ? `Giảm giá theo từng sản phẩm (${positiveProductDiscountCount} sản phẩm)`
      : null;
  }

  if (manualDiscountValueType === "amount") {
    return manualDiscountAmount > 0 ? "Giảm giá theo tổng đơn" : null;
  }

  return manualDiscountPercent > 0 ? "Giảm giá theo tổng đơn" : null;
}

async function createOrderDirectly(params: {
  db: SupabaseAdminClient;
  customerName: string;
  customerPhone: string;
  customerAddress: string;
  notes: string;
  voucherCode?: string;
  checkoutMethod: CheckoutMethod;
  paymentMethod: PaymentMethod;
  isCounterSale?: boolean;
  items: CartItem[];
  customerDiscountPercent?: number;
  manualDiscountPercent?: number;
  manualDiscountValueType?: ManualDiscountValueType;
  manualDiscountAmount?: number;
  manualDiscountMode?: "order_total" | "product_items";
  manualProductDiscounts?: ManualProductDiscount[];
}): Promise<CreateOrderResponse> {
  const {
    db,
    customerName,
    customerPhone,
    customerAddress,
    notes,
    voucherCode = "",
    checkoutMethod,
    paymentMethod,
    isCounterSale = false,
    items,
    customerDiscountPercent = 0,
    manualDiscountPercent = 0,
    manualDiscountValueType = "percent",
    manualDiscountAmount = 0,
    manualDiscountMode = "order_total",
    manualProductDiscounts = [],
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
    .select(
      "id, name, price, discount_percent, category, stock_quantity, is_active",
    )
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

  const variantIds = Array.from(
    new Set(
      items
        .map((item) => item.variant_id)
        .filter((item): item is string => Boolean(item)),
    ),
  );
  let variantMap = new Map<string, ProductVariantForOrder>();

  if (variantIds.length > 0) {
    const { data: variantsData } = await db
      .from("product_variants")
      .select("id, product_id, variant_name, price, is_active")
      .in("id", variantIds);

    const variantRows = (variantsData || []) as ProductVariantForOrder[];
    variantMap = new Map(variantRows.map((variant) => [variant.id, variant]));
  }

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

    if (item.variant_id) {
      const variant = variantMap.get(item.variant_id);
      if (
        !variant ||
        !variant.is_active ||
        variant.product_id !== item.product_id
      ) {
        return {
          success: false,
          message: `Loại sản phẩm không hợp lệ cho \"${product.name}\"`,
        };
      }
    }
  }

  const baseOrderInsert = {
    customer_name: customerName,
    customer_phone: customerPhone,
    customer_address: customerAddress,
    total_amount: 0,
    status: isCounterSale ? "completed" : "pending",
    order_type: isCounterSale ? "counter" : "online",
    notes,
  };

  const orderInsertWithPayment = {
    ...baseOrderInsert,
    checkout_method: checkoutMethod,
    payment_method: paymentMethod,
    payment_confirmed: isCounterSale || paymentMethod === "cod",
    payment_confirmed_at:
      isCounterSale || paymentMethod === "cod"
        ? new Date().toISOString()
        : null,
    payment_confirmed_by:
      isCounterSale || paymentMethod === "cod" ? "system" : null,
  };

  let orderId: string | null = null;
  let orderInsertError: { code?: string; message?: string } | null = null;
  const mutationDb = db as unknown as OrderMutationClient;

  const { data: createdWithPayment, error: createWithPaymentError } =
    await mutationDb
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

    const { data: createdBase, error: createBaseError } = await mutationDb
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

  const manualProductDiscountMap = new Map<
    string,
    NormalizedManualProductDiscount
  >(
    (manualProductDiscounts || []).map((item) => {
      const valueType = normalizeManualDiscountValueType(item.valueType);

      return [
        item.productId,
        {
          productId: item.productId,
          valueType,
          percent: valueType === "percent" ? normalizePercent(item.percent) : 0,
          amount:
            valueType === "amount" ? normalizeMoneyAmount(item.amount) : 0,
        },
      ];
    }),
  );
  const safeCustomerDiscount = normalizePercent(customerDiscountPercent);
  const safeManualDiscount = normalizePercent(manualDiscountPercent);
  const safeManualDiscountAmount = normalizeMoneyAmount(manualDiscountAmount);
  const safeManualDiscountValueType = normalizeManualDiscountValueType(
    manualDiscountValueType,
  );
  const normalizedVoucherCode = String(voucherCode || "")
    .trim()
    .toUpperCase();
  const preparedLines: PreparedOrderLine[] = items.map((item) => {
    const product = productMap.get(item.product_id)!;
    const selectedVariant = item.variant_id
      ? variantMap.get(item.variant_id)
      : null;
    const baseSourcePrice = Number(selectedVariant?.price || product.price);
    const discountedUnitPrice = calculateEffectivePrice(
      baseSourcePrice,
      product.discount_percent,
    );
    const baseUnitPrice = Math.round(
      discountedUnitPrice * (1 - safeCustomerDiscount / 100),
    );

    return {
      productId: item.product_id,
      quantity: item.quantity,
      baseUnitPrice,
    };
  });

  const grossAmount = calculateOrderGrossAmount(preparedLines);
  let appliedVoucher: {
    id: string;
    code: string;
    discountAmount: number;
  } | null = null;

  if (normalizedVoucherCode) {
    const voucherPreview = await previewVoucherDiscount({
      sb: db,
      voucherCode: normalizedVoucherCode,
      customerPhone,
      orderAmount: grossAmount,
    });

    appliedVoucher = {
      id: voucherPreview.voucher.id,
      code: voucherPreview.voucher.voucher_code,
      discountAmount: voucherPreview.discountAmount,
    };
  }

  const orderItemsPayload =
    appliedVoucher && appliedVoucher.discountAmount > 0
      ? buildAmountDiscountOrderItems(
          orderId,
          preparedLines,
          appliedVoucher.discountAmount,
        )
      : manualDiscountMode === "order_total" &&
          safeManualDiscountValueType === "amount"
        ? buildAmountDiscountOrderItems(
            orderId,
            preparedLines,
            safeManualDiscountAmount,
          )
        : manualDiscountMode === "product_items"
          ? buildProductDiscountOrderItems(
              orderId,
              preparedLines,
              manualProductDiscountMap,
            )
          : preparedLines.map((line) =>
              buildPercentDiscountOrderItem(orderId, line, safeManualDiscount),
            );

  const finalAmount = calculateOrderFinalAmount(orderItemsPayload);
  const discountAmount = Math.max(0, grossAmount - finalAmount);
  const positiveProductDiscountCount = Array.from(
    manualProductDiscountMap.values(),
  ).filter((item) => item.percent > 0 || item.amount > 0).length;
  const discountLabel = buildDiscountLabel({
    manualDiscountMode,
    manualDiscountValueType: safeManualDiscountValueType,
    manualDiscountPercent: safeManualDiscount,
    manualDiscountAmount: safeManualDiscountAmount,
    positiveProductDiscountCount,
  });
  const finalDiscountLabel =
    appliedVoucher && appliedVoucher.discountAmount > 0
      ? `Voucher ${appliedVoucher.code}`
      : discountLabel;
  const finalNotes = [
    notes.trim(),
    discountAmount > 0 ? finalDiscountLabel : null,
    discountAmount > 0
      ? `Số tiền giảm: ${discountAmount.toLocaleString("vi-VN")}đ`
      : null,
  ]
    .filter((line): line is string => Boolean(line && line.trim()))
    .join("\n");

  const { error: orderItemsError } = await mutationDb
    .from("order_items")
    .insert(orderItemsPayload);

  if (orderItemsError) {
    await mutationDb.from("orders").delete().eq("id", orderId);
    return {
      success: false,
      message: `Không thể tạo chi tiết đơn hàng: ${orderItemsError.message}`,
    };
  }

  if (discountAmount > 0 && finalNotes !== notes) {
    const { error: updateNotesError } = await mutationDb
      .from("orders")
      .update({ notes: finalNotes })
      .eq("id", orderId);

    if (updateNotesError) {
      console.warn(
        "Không thể cập nhật ghi chú giảm giá cho đơn hàng:",
        updateNotesError,
      );
    }
  }

  const { data: finalOrder, error: finalOrderError } = await mutationDb
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

  if (appliedVoucher && appliedVoucher.discountAmount > 0) {
    try {
      await consumeVoucherForOrder({
        sb: db,
        voucherId: appliedVoucher.id,
        orderId: finalOrder.id,
        discountAmount: appliedVoucher.discountAmount,
      });
    } catch (consumeError) {
      console.warn("Không thể đánh dấu voucher đã sử dụng:", consumeError);
    }
  }

  return {
    success: true,
    orderId: finalOrder.id,
    appliedVoucherCode: appliedVoucher?.code || null,
    appliedVoucherDiscountAmount: appliedVoucher?.discountAmount || 0,
    grossAmount,
    discountAmount,
    discountLabel: finalDiscountLabel,
    totalAmount: Number(finalOrder.total_amount || 0),
    message: "Tạo đơn hàng thành công",
  };
}

/**
 * Server Action: Tạo đơn hàng mới
 *
 * Logic:
 * 1. Validate input
 * 2. Tạo đơn hàng trực tiếp trong DB:
 *    - Kiểm tra tồn kho từng sản phẩm
 *    - Tạo order + order_items (đã áp giảm giá)
 *    - Trigger DB tự cập nhật (trừ) tồn kho
 */
export async function createOrder(
  request: CreateOrderRequest,
): Promise<CreateOrderResponse> {
  try {
    const orderWriteClient = createOrderWriteClient();
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
    const isCounterSale = Boolean(request.isCounterSale);

    if (isCounterSale) {
      const authClient = await createServerSupabaseClient();
      const {
        data: { user },
      } = await authClient.auth.getUser();

      if (!user) {
        return {
          success: false,
          message: "Bạn cần đăng nhập để tạo đơn bán tại quầy",
        };
      }
    }

    const submittedName = request.customer.name?.trim() || "";
    const submittedPhone = request.customer.phone?.trim() || "";
    const normalizedPhone = normalizePhone(submittedPhone);
    const isCounterGuestCustomer =
      isCounterSale && (!normalizedPhone || isGuestPhone(normalizedPhone));

    const customerName =
      submittedName || (isCounterSale ? GUEST_CUSTOMER_NAME : "");
    const customerPhone = isCounterGuestCustomer
      ? createGuestCustomerPhone()
      : normalizedPhone;
    const manualDiscountPercent = normalizePercent(
      request.manualDiscountPercent,
    );
    const manualDiscountValueType = normalizeManualDiscountValueType(
      request.manualDiscountValueType,
    );
    const manualDiscountAmount = normalizeMoneyAmount(
      request.manualDiscountAmount,
    );
    const manualDiscountMode = request.manualDiscountMode || "order_total";
    const normalizedVoucherCode = String(request.voucherCode || "")
      .trim()
      .toUpperCase();
    const manualProductDiscounts = Array.from(
      new Map(
        (request.manualProductDiscounts || [])
          .filter((item) => item.productId)
          .map((item) => {
            const valueType = normalizeManualDiscountValueType(item.valueType);

            return [
              item.productId,
              {
                productId: item.productId,
                valueType,
                percent:
                  valueType === "percent" ? normalizePercent(item.percent) : 0,
                amount:
                  valueType === "amount"
                    ? normalizeMoneyAmount(item.amount)
                    : 0,
              },
            ];
          }),
      ),
    ).map(([, discount]) => discount);
    if (manualDiscountMode === "product_items") {
      const orderItemIds = new Set(
        request.items.map((item) => item.product_id),
      );
      const hasInvalidProduct = manualProductDiscounts.some(
        (item) => !orderItemIds.has(item.productId),
      );
      if (hasInvalidProduct) {
        return {
          success: false,
          message:
            "Sản phẩm giảm giá không hợp lệ. Vui lòng chọn sản phẩm có trong giỏ hàng.",
        };
      }
    }

    const hasOrderPercentDiscount =
      manualDiscountMode === "order_total" &&
      manualDiscountValueType === "percent" &&
      manualDiscountPercent > 0;
    const hasOrderAmountDiscount =
      manualDiscountMode === "order_total" &&
      manualDiscountValueType === "amount" &&
      manualDiscountAmount > 0;
    const hasProductLineDiscount = manualProductDiscounts.some(
      (item) => item.percent > 0 || item.amount > 0,
    );

    if (
      normalizedVoucherCode &&
      (hasOrderPercentDiscount ||
        hasOrderAmountDiscount ||
        hasProductLineDiscount)
    ) {
      return {
        success: false,
        message:
          "Voucher không thể dùng đồng thời với giảm giá thủ công. Vui lòng chọn một hình thức giảm giá.",
      };
    }

    // Validate input
    if (!customerName) {
      return {
        success: false,
        message: "Vui lòng nhập tên khách hàng",
      };
    }

    if (!customerPhone) {
      return {
        success: false,
        message: "Vui lòng nhập số điện thoại",
      };
    }

    if (!isCounterSale && isGuestPhone(customerPhone)) {
      return {
        success: false,
        message: "Vui lòng nhập số điện thoại hợp lệ",
      };
    }

    if (
      submittedPhone &&
      !isCounterGuestCustomer &&
      normalizedPhone.length < 10
    ) {
      return {
        success: false,
        message: "Số điện thoại không hợp lệ",
      };
    }

    if (
      !isCounterSale &&
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

    const resolvedAddress = isCounterSale
      ? "Mua tại quầy"
      : request.customer.address?.trim()
        ? request.customer.address.trim()
        : "Sẽ trao đổi khi tư vấn qua điện thoại";

    const extraNotes = isCounterSale
      ? [
          "Hình thức đặt hàng: Bán tại quầy",
          "Thanh toán: Đã thanh toán tại quầy",
        ]
      : [
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

    const createResult = await createOrderDirectly({
      db: orderWriteClient,
      customerName,
      customerPhone,
      customerAddress: resolvedAddress,
      notes: finalNotes,
      voucherCode: normalizedVoucherCode,
      checkoutMethod,
      paymentMethod,
      isCounterSale,
      items: request.items,
      manualDiscountPercent,
      manualDiscountValueType,
      manualDiscountAmount,
      manualDiscountMode,
      manualProductDiscounts,
    });

    if (!createResult.success || !createResult.orderId) {
      return createResult;
    }

    await AuditLogger.orderCreated(
      createResult.orderId,
      customerName,
      createResult.totalAmount || 0,
      request.items.length,
    );

    if (
      isCounterSale &&
      createResult.totalAmount &&
      createResult.totalAmount > 0
    ) {
      try {
        const pointResult = await awardPointsForOrder({
          sb: orderWriteClient,
          orderId: createResult.orderId,
          customerPhone,
          totalAmount: Number(createResult.totalAmount || 0),
          createdBy: "system",
        });
        createResult.earnedPoints = pointResult.earnedPoints;
        createResult.currentPointBalance = pointResult.currentPointBalance;
      } catch (pointError) {
        console.warn(
          "Không thể cộng điểm tự động cho đơn tại quầy:",
          pointError,
        );
      }
    }

    if (!isCounterSale) {
      try {
        await sendOrderNotificationEmail({
          orderId: createResult.orderId,
          customerName,
          customerPhone,
          customerAddress: resolvedAddress,
          checkoutMethod,
          paymentMethod,
          totalAmount: Number(createResult.totalAmount || 0),
          itemCount: request.items.length,
        });
      } catch (notifyError) {
        console.warn(
          "Order created but email notification failed:",
          notifyError,
        );
      }
    }

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
        order_status_history (
          id,
          status,
          note,
          created_at
        ),
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
        order_type,
        checkout_method,
        payment_method,
        payment_confirmed,
        payment_confirmed_at,
        notes,
        created_at,
        order_status_history (
          id,
          status,
          note,
          created_at
        ),
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
