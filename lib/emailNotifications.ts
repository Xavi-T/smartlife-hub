import { APP_CONFIG } from "@/lib/appConfig";
import {
  getActivityLevelLabel,
  getNutritionGoalLabel,
  type NutritionActivityLevel,
  type NutritionGender,
  type NutritionGoal,
} from "@/lib/nutrition";
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

interface ConsultationCalculationInput {
  ageYears?: number | null;
  gender?: NutritionGender | null;
  heightCm?: number | null;
  weightKg?: number | null;
  activityLevel?: NutritionActivityLevel | null;
  goal?: NutritionGoal | null;
  bmi?: number | null;
  bmiCategory?: string | null;
  bmr?: number | null;
  tdee?: number | null;
  targetCalories?: number | null;
  proteinG?: number | null;
  fatG?: number | null;
  carbG?: number | null;
}

interface SendConsultationNotificationInput {
  clientId: string;
  assessmentId?: string | null;
  fullName: string;
  phone: string;
  source: string;
  sourcePath?: string | null;
  requestType?: string | null;
  preferredTime?: string | null;
  medicalNotes?: string | null;
  allergies?: string | null;
  message?: string | null;
  calculation?: ConsultationCalculationInput | null;
}

function resolveCheckoutMethodLabel(value: CheckoutMethod): string {
  return value === "bank_transfer" ? "Chuyển khoản" : "Ship COD";
}

function resolvePaymentMethodLabel(value: PaymentMethod): string {
  if (value === "bank_transfer") return "Chuyển khoản";
  if (value === "cash") return "Tiền mặt";
  return "Thanh toán khi nhận hàng";
}

function isEmailNotificationConfigured(): boolean {
  return Boolean(
    process.env.EMAILJS_SERVICE_ID &&
    process.env.EMAILJS_TEMPLATE_ID &&
    process.env.EMAILJS_PUBLIC_KEY &&
    process.env.EMAILJS_PRIVATE_KEY,
  );
}

function resolveGenderLabel(value?: NutritionGender | null): string {
  if (value === "male") return "Nam";
  if (value === "female") return "Nữ";
  if (value === "other") return "Khác";
  return "Chưa có";
}

function formatOptionalNumber(value?: number | null, suffix = ""): string {
  if (value === null || value === undefined || Number.isNaN(Number(value))) {
    return "Chưa có";
  }
  return `${Number(value).toLocaleString("vi-VN")}${suffix}`;
}

function formatCreatedAt(): string {
  return new Date().toLocaleString("vi-VN", {
    timeZone: "Asia/Ho_Chi_Minh",
  });
}

async function sendEmailJsTemplate(
  templateParams: Record<string, string | number | null | undefined>,
): Promise<boolean> {
  if (!isEmailNotificationConfigured()) {
    return false;
  }

  const payload = {
    service_id: process.env.EMAILJS_SERVICE_ID,
    template_id: process.env.EMAILJS_TEMPLATE_ID,
    user_id: process.env.EMAILJS_PUBLIC_KEY,
    accessToken: process.env.EMAILJS_PRIVATE_KEY,
    template_params: {
      to_email: process.env.EMAILJS_NOTIFY_TO || APP_CONFIG.shopEmail,
      shop_name: APP_CONFIG.shopName,
      ...templateParams,
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

  return true;
}

export async function sendOrderNotificationEmail(
  input: SendOrderNotificationInput,
): Promise<void> {
  await sendEmailJsTemplate({
    notification_title: "Đơn hàng mới",
    notification_summary: `${input.customerName} - ${input.customerPhone}`,
    order_id: input.orderId,
    customer_name: input.customerName,
    customer_phone: input.customerPhone,
    customer_address: input.customerAddress,
    checkout_method: resolveCheckoutMethodLabel(input.checkoutMethod),
    payment_method: resolvePaymentMethodLabel(input.paymentMethod),
    total_amount: Number(input.totalAmount || 0).toLocaleString("vi-VN"),
    total_items: input.itemCount,
    created_at: formatCreatedAt(),
    admin_link: `${APP_CONFIG.shopWebsite}/admin/orders`,
  });
}

export async function sendConsultationNotificationEmail(
  input: SendConsultationNotificationInput,
): Promise<boolean> {
  const calculation = input.calculation;
  const details = [
    `Khách hàng: ${input.fullName}`,
    `SĐT: ${input.phone}`,
    `Nguồn: ${input.source}`,
    `Trang gửi: ${input.sourcePath || "Không rõ"}`,
    `Nhu cầu: ${input.requestType || "Tư vấn dinh dưỡng"}`,
    `Thời gian mong muốn: ${input.preferredTime || "Chưa có"}`,
    `Ghi chú: ${input.message || "Không có"}`,
    `Tình trạng sức khỏe: ${input.medicalNotes || "Không có"}`,
    `Dị ứng/kiêng ăn: ${input.allergies || "Không có"}`,
    `Tuổi: ${formatOptionalNumber(calculation?.ageYears)}`,
    `Giới tính: ${resolveGenderLabel(calculation?.gender)}`,
    `Chiều cao: ${formatOptionalNumber(calculation?.heightCm, " cm")}`,
    `Cân nặng: ${formatOptionalNumber(calculation?.weightKg, " kg")}`,
    `Mức vận động: ${
      calculation?.activityLevel
        ? getActivityLevelLabel(calculation.activityLevel)
        : "Chưa có"
    }`,
    `Mục tiêu: ${
      calculation?.goal ? getNutritionGoalLabel(calculation.goal) : "Chưa có"
    }`,
    `BMI: ${formatOptionalNumber(calculation?.bmi)} (${calculation?.bmiCategory || "Chưa có"})`,
    `BMR: ${formatOptionalNumber(calculation?.bmr, " kcal/ngày")}`,
    `TDEE: ${formatOptionalNumber(calculation?.tdee, " kcal/ngày")}`,
    `Calo mục tiêu: ${formatOptionalNumber(
      calculation?.targetCalories,
      " kcal/ngày",
    )}`,
    `Macro: Protein ${formatOptionalNumber(
      calculation?.proteinG,
      " g",
    )}, Fat ${formatOptionalNumber(
      calculation?.fatG,
      " g",
    )}, Carb ${formatOptionalNumber(calculation?.carbG, " g")}`,
  ].join("\n");

  const summary = `${input.fullName} - ${input.phone} - ${
    input.requestType || "Tư vấn dinh dưỡng"
  }`;

  return sendEmailJsTemplate({
    notification_title: "Yêu cầu tư vấn dinh dưỡng mới",
    notification_summary: summary,
    notification_details: details,
    consultation_id: input.clientId,
    assessment_id: input.assessmentId || "",
    source: input.source,
    source_path: input.sourcePath || "",
    request_type: input.requestType || "Tư vấn dinh dưỡng",
    preferred_time: input.preferredTime || "",
    customer_name: input.fullName,
    customer_phone: input.phone,
    customer_address: details,
    order_id: `TU_VAN_${input.clientId.slice(0, 8)}`,
    checkout_method: "Tư vấn dinh dưỡng",
    payment_method: input.source,
    total_amount: "0",
    total_items: calculation?.targetCalories || 0,
    created_at: formatCreatedAt(),
    admin_link: `${APP_CONFIG.shopWebsite}/admin/nutrition/clients`,
  });
}
