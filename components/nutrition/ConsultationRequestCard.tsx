"use client";

import { useState } from "react";
import {
  Button,
  Card,
  Checkbox,
  Form,
  Input,
  Select,
  Typography,
  message,
} from "antd";
import { SendOutlined } from "@ant-design/icons";
import {
  ACTIVITY_LEVEL_OPTIONS,
  GENDER_OPTIONS,
  GOAL_OPTIONS,
  type NutritionActivityLevel,
  type NutritionCalculationResult,
  type NutritionGender,
  type NutritionGoal,
} from "@/lib/nutrition";

export interface ConsultationCalculationSnapshot {
  ageYears?: number | null;
  gender?: NutritionGender | null;
  heightCm?: number | null;
  weightKg?: number | null;
  activityLevel?: NutritionActivityLevel | null;
  goal?: NutritionGoal | null;
  result?: NutritionCalculationResult | null;
}

interface ConsultationRequestCardProps {
  source: string;
  title?: string;
  description?: string;
  defaultMessage?: string;
  calculation?: ConsultationCalculationSnapshot | null;
}

interface ConsultationFormValues {
  fullName: string;
  phone: string;
  website?: string;
  requestType: string;
  preferredTime?: string;
  medicalNotes?: string;
  allergies?: string;
  message?: string;
  gender: NutritionGender;
  activityLevel: NutritionActivityLevel;
  goal: NutritionGoal;
  consentGiven: boolean;
}

const requestTypeOptions = [
  { label: "Tư vấn dinh dưỡng cá nhân", value: "Tư vấn dinh dưỡng cá nhân" },
  { label: "Tư vấn mẹ và bé", value: "Tư vấn mẹ và bé" },
  { label: "Tư vấn giảm/tăng cân", value: "Tư vấn giảm/tăng cân" },
  { label: "Chọn sản phẩm phù hợp", value: "Chọn sản phẩm phù hợp" },
  { label: "Đặt lịch tại quán", value: "Đặt lịch tại quán" },
];

export function ConsultationRequestCard({
  source,
  title = "Nhận tư vấn từ SmartLife Hub",
  description = "Để lại thông tin, bác sĩ/chuyên viên dinh dưỡng sẽ xem chỉ số và liên hệ lại.",
  defaultMessage,
  calculation,
}: ConsultationRequestCardProps) {
  const [form] = Form.useForm<ConsultationFormValues>();
  const [messageApi, contextHolder] = message.useMessage();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const initialGender = calculation?.gender || "female";
  const initialActivityLevel = calculation?.activityLevel || "light";
  const initialGoal = calculation?.goal || "maintain";

  const handleSubmit = async (values: ConsultationFormValues) => {
    setIsSubmitting(true);
    try {
      const payload = {
        ...values,
        source,
        sourcePath:
          typeof window === "undefined" ? "" : window.location.href,
        ageYears: calculation?.ageYears,
        heightCm: calculation?.heightCm,
        weightKg: calculation?.weightKg,
        gender: calculation?.gender || values.gender,
        activityLevel: calculation?.activityLevel || values.activityLevel,
        goal: calculation?.goal || values.goal,
        bmi: calculation?.result?.bmi,
        bmiCategory: calculation?.result?.bmiCategory,
        bmr: calculation?.result?.bmr,
        tdee: calculation?.result?.tdee,
        targetCalories: calculation?.result?.targetCalories,
        proteinG: calculation?.result?.proteinG,
        fatG: calculation?.result?.fatG,
        carbG: calculation?.result?.carbG,
      };

      const response = await fetch("/api/nutrition/consultation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Không thể gửi thông tin tư vấn");
      }

      if (result.emailWarning) {
        messageApi.warning(result.emailWarning);
      } else {
        messageApi.success(result.message || "Đã gửi thông tin tư vấn");
      }

      form.resetFields();
    } catch (error: unknown) {
      messageApi.error(
        error instanceof Error ? error.message : "Không thể gửi thông tin",
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Card
      className="sl-animate-in"
      styles={{ body: { padding: 16 } }}
      title={title}
    >
      {contextHolder}
      <Typography.Paragraph type="secondary" style={{ marginTop: -4 }}>
        {description}
      </Typography.Paragraph>

      <Form<ConsultationFormValues>
        form={form}
        layout="vertical"
        initialValues={{
          requestType: requestTypeOptions[0].value,
          message: defaultMessage,
          gender: initialGender,
          activityLevel: initialActivityLevel,
          goal: initialGoal,
          consentGiven: true,
        }}
        onFinish={handleSubmit}
      >
        <div className="grid grid-cols-1 gap-x-3 sm:grid-cols-2">
          <Form.Item
            name="fullName"
            label="Họ tên"
            rules={[{ required: true, message: "Nhập họ tên" }]}
          >
            <Input placeholder="Ví dụ: Nguyễn An" />
          </Form.Item>

          <Form.Item
            name="phone"
            label="Số điện thoại"
            rules={[
              { required: true, message: "Nhập số điện thoại" },
              {
                pattern: /^[0-9+\s().-]{8,20}$/,
                message: "Số điện thoại chưa hợp lệ",
              },
            ]}
          >
            <Input inputMode="tel" placeholder="Ví dụ: 0838 709 126" />
          </Form.Item>

          <Form.Item name="website" className="hidden" aria-hidden>
            <Input tabIndex={-1} autoComplete="off" />
          </Form.Item>

          <Form.Item name="requestType" label="Nhu cầu tư vấn">
            <Select options={requestTypeOptions} />
          </Form.Item>

          <Form.Item name="preferredTime" label="Thời gian muốn được gọi">
            <Input placeholder="Ví dụ: Tối nay, chiều mai, cuối tuần..." />
          </Form.Item>
        </div>

        {!calculation?.result && (
          <div className="grid grid-cols-1 gap-x-3 sm:grid-cols-3">
            <Form.Item name="gender" label="Giới tính">
              <Select options={GENDER_OPTIONS} />
            </Form.Item>
            <Form.Item name="activityLevel" label="Mức vận động">
              <Select options={ACTIVITY_LEVEL_OPTIONS} />
            </Form.Item>
            <Form.Item name="goal" label="Mục tiêu">
              <Select options={GOAL_OPTIONS} />
            </Form.Item>
          </div>
        )}

        <Form.Item name="medicalNotes" label="Tình trạng sức khỏe cần lưu ý">
          <Input.TextArea
            rows={2}
            placeholder="Ví dụ: mẹ bầu, sau sinh, tiểu đường, mỡ máu, trẻ biếng ăn..."
          />
        </Form.Item>

        <Form.Item name="allergies" label="Dị ứng/kiêng ăn nếu có">
          <Input placeholder="Ví dụ: dị ứng sữa bò, không ăn hải sản..." />
        </Form.Item>

        <Form.Item name="message" label="Ghi chú thêm">
          <Input.TextArea
            rows={3}
            placeholder="Bạn muốn bác sĩ/chuyên viên hỗ trợ điều gì?"
          />
        </Form.Item>

        <Form.Item
          name="consentGiven"
          valuePropName="checked"
          rules={[
            {
              validator: (_, value) =>
                value
                  ? Promise.resolve()
                  : Promise.reject(
                      new Error("Vui lòng đồng ý để được liên hệ tư vấn"),
                    ),
            },
          ]}
        >
          <Checkbox>
            Tôi đồng ý để SmartLife Hub lưu thông tin và liên hệ tư vấn.
          </Checkbox>
        </Form.Item>

        <Button
          type="primary"
          htmlType="submit"
          icon={<SendOutlined />}
          loading={Boolean(isSubmitting)}
          className="w-full sm:w-auto"
        >
          Gửi thông tin tư vấn
        </Button>
      </Form>
    </Card>
  );
}
