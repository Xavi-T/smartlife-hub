import { supabase } from "./supabase";

/**
 * Audit Logger - Ghi log cho các thay đổi quan trọng
 */

export interface AuditLogParams {
  eventType: string;
  entityType: string;
  entityId?: string;
  actor?: string;
  action: string;
  description: string;
  oldValues?: Record<string, any>;
  newValues?: Record<string, any>;
  metadata?: Record<string, any>;
}

export async function logAudit(params: AuditLogParams): Promise<void> {
  try {
    const { error } = await supabase.rpc("log_audit_event", {
      p_event_type: params.eventType,
      p_entity_type: params.entityType,
      p_entity_id: params.entityId || null,
      p_actor: params.actor || "Admin",
      p_action: params.action,
      p_description: params.description,
      p_old_values: params.oldValues ? JSON.stringify(params.oldValues) : null,
      p_new_values: params.newValues ? JSON.stringify(params.newValues) : null,
      p_metadata: params.metadata ? JSON.stringify(params.metadata) : null,
    });

    if (error) {
      console.error("Error logging audit event:", error);
    }
  } catch (error) {
    console.error("Failed to log audit event:", error);
  }
}

/**
 * Pre-built audit log helpers
 */

export const AuditLogger = {
  // Product events
  productCreated: (productId: string, productName: string, data: any) =>
    logAudit({
      eventType: "product.created",
      entityType: "product",
      entityId: productId,
      action: "create",
      description: `Đã tạo sản phẩm mới: ${productName}`,
      newValues: data,
    }),

  productUpdated: (
    productId: string,
    productName: string,
    oldData: any,
    newData: any,
    changedFields: string[],
  ) =>
    logAudit({
      eventType: "product.updated",
      entityType: "product",
      entityId: productId,
      action: "update",
      description: `Đã cập nhật sản phẩm: ${productName} (${changedFields.join(", ")})`,
      oldValues: oldData,
      newValues: newData,
      metadata: { changedFields },
    }),

  productPriceUpdated: (
    productId: string,
    productName: string,
    oldPrice: number,
    newPrice: number,
  ) =>
    logAudit({
      eventType: "product.price_updated",
      entityType: "product",
      entityId: productId,
      action: "update",
      description: `Đã sửa giá sản phẩm "${productName}" từ ${oldPrice.toLocaleString()}đ thành ${newPrice.toLocaleString()}đ`,
      oldValues: { price: oldPrice },
      newValues: { price: newPrice },
    }),

  productStockUpdated: (
    productId: string,
    productName: string,
    oldStock: number,
    newStock: number,
    reason: string,
  ) =>
    logAudit({
      eventType: "product.stock_updated",
      entityType: "product",
      entityId: productId,
      action: "update",
      description: `Số lượng kho sản phẩm "${productName}" thay đổi từ ${oldStock} thành ${newStock} (${reason})`,
      oldValues: { stock_quantity: oldStock },
      newValues: { stock_quantity: newStock },
      metadata: { reason },
    }),

  productDeleted: (productId: string, productName: string) =>
    logAudit({
      eventType: "product.deleted",
      entityType: "product",
      entityId: productId,
      action: "delete",
      description: `Đã xóa sản phẩm: ${productName}`,
    }),

  // Order events
  orderCreated: (
    orderId: string,
    customerName: string,
    totalAmount: number,
    itemCount: number,
  ) =>
    logAudit({
      eventType: "order.created",
      entityType: "order",
      entityId: orderId,
      action: "create",
      description: `Đơn hàng mới từ ${customerName} - ${itemCount} sản phẩm - ${totalAmount.toLocaleString()}đ`,
      newValues: { total_amount: totalAmount, item_count: itemCount },
      metadata: { customer_name: customerName },
    }),

  orderStatusChanged: (
    orderId: string,
    orderCode: string,
    oldStatus: string,
    newStatus: string,
    customerName: string,
  ) => {
    const statusLabels: Record<string, string> = {
      pending: "Chờ xác nhận",
      processing: "Đang giao",
      delivered: "Đã giao",
      cancelled: "Đã hủy",
    };

    return logAudit({
      eventType: "order.status_changed",
      entityType: "order",
      entityId: orderId,
      action: "update",
      description: `Đã cập nhật đơn hàng #${orderCode} (${customerName}) từ "${statusLabels[oldStatus]}" sang "${statusLabels[newStatus]}"`,
      oldValues: { status: oldStatus },
      newValues: { status: newStatus },
      metadata: { customer_name: customerName, order_code: orderCode },
    });
  },

  orderCancelled: (
    orderId: string,
    orderCode: string,
    customerName: string,
    reason?: string,
  ) =>
    logAudit({
      eventType: "order.cancelled",
      entityType: "order",
      entityId: orderId,
      action: "update",
      description: `Đã hủy đơn hàng #${orderCode} (${customerName})${reason ? ` - Lý do: ${reason}` : ""}`,
      metadata: { customer_name: customerName, order_code: orderCode, reason },
    }),

  // Stock inbound events
  stockInbound: (
    productId: string,
    productName: string,
    quantity: number,
    costPrice: number,
    supplier?: string,
  ) =>
    logAudit({
      eventType: "stock.inbound",
      entityType: "product",
      entityId: productId,
      action: "update",
      description: `Đã nhập ${quantity} sản phẩm "${productName}" với giá ${costPrice.toLocaleString()}đ${supplier ? ` từ ${supplier}` : ""}`,
      newValues: { quantity_added: quantity, cost_price: costPrice },
      metadata: { supplier },
    }),

  // System events
  systemEvent: (description: string, metadata?: Record<string, any>) =>
    logAudit({
      eventType: "system.event",
      entityType: "system",
      action: "system",
      description,
      actor: "System",
      metadata,
    }),
};
