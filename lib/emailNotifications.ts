import { APP_CONFIG } from "@/lib/appConfig";
import type { CheckoutMethod, PaymentMethod } from "@/types/order";

interface SendOrderNotificationInput {
  orderId: string;
  customerName: string;
  customerPhone: string;
  customerAddress: string;
  checkoutMethod: CheckoutMethod;
  paymentMethod: PaymentMethod;
  totalAmount: number;
  itemCount: number;
}

function resolveCheckoutMethodLabel(value: CheckoutMethod): string {
  return value === "bank_transfer" ? "Chuyển khoản" : "Ship COD";
}

function resolvePaymentMethodLabel(value: PaymentMethod): string {
  return value === "bank_transfer"
    ? "Chuyển khoản"
    : "Thanh toán khi nhận hàng";
}

function isEmailNotificationConfigured(): boolean {
  return Boolean(
    process.env.EMAILJS_SERVICE_ID &&
    process.env.EMAILJS_TEMPLATE_ID &&
    process.env.EMAILJS_PUBLIC_KEY &&
    process.env.EMAILJS_PRIVATE_KEY,
  );
}

export async function sendOrderNotificationEmail(
  input: SendOrderNotificationInput,
): Promise<void> {
  if (!isEmailNotificationConfigured()) {
    return;
  }

  const payload = {
    service_id: process.env.EMAILJS_SERVICE_ID,
    template_id: process.env.EMAILJS_TEMPLATE_ID,
    user_id: process.env.EMAILJS_PUBLIC_KEY,
    accessToken: process.env.EMAILJS_PRIVATE_KEY,
    template_params: {
      to_email: process.env.EMAILJS_NOTIFY_TO || APP_CONFIG.shopEmail,
      shop_name: APP_CONFIG.shopName,
      order_id: input.orderId,
      customer_name: input.customerName,
      customer_phone: input.customerPhone,
      customer_address: input.customerAddress,
      checkout_method: resolveCheckoutMethodLabel(input.checkoutMethod),
      payment_method: resolvePaymentMethodLabel(input.paymentMethod),
      total_amount: Number(input.totalAmount || 0).toLocaleString("vi-VN"),
      total_items: input.itemCount,
      created_at: new Date().toLocaleString("vi-VN", {
        timeZone: "Asia/Ho_Chi_Minh",
      }),
      admin_link: `${APP_CONFIG.shopWebsite}/admin/orders`,
    },
  };

  const response = await fetch("https://api.emailjs.com/api/v1.0/email/send", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
    cache: "no-store",
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(
      `EmailJS gửi thông báo thất bại (${response.status}): ${errorText}`,
    );
  }
}
