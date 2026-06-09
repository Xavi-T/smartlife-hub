"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Alert,
  Button,
  Card,
  Form,
  Input,
  InputNumber,
  Select,
  Space,
  Statistic,
  Table,
  Tag,
  Typography,
  message,
} from "antd";
import type { ColumnsType } from "antd/es/table";
import {
  PrinterOutlined,
  SaveOutlined,
  UserAddOutlined,
} from "@ant-design/icons";
import { useRouter } from "next/navigation";
import {
  ACTIVITY_LEVEL_OPTIONS,
  GENDER_OPTIONS,
  GOAL_OPTIONS,
  calculateAgeFromBirthDate,
  calculateNutritionMetrics,
  getActivityLevelLabel,
  getNutritionGoalLabel,
  type NutritionActivityLevel,
  type NutritionCalculationResult,
  type NutritionGender,
  type NutritionGoal,
} from "@/lib/nutrition";
import type {
  NutritionAssessment,
  NutritionClient,
  Product,
} from "@/types/database";
import { formatCurrency, formatNumber } from "@/lib/utils";
import { APP_CONFIG } from "@/lib/appConfig";

interface CalculatorFormValues {
  clientId: string;
  ageYears: number;
  gender: NutritionGender;
  heightCm: number;
  weightKg: number;
  activityLevel: NutritionActivityLevel;
  goal: NutritionGoal;
  doctorNotes?: string;
  recommendationText?: string;
  relatedProductIds?: string[];
}

type ClientOption = NutritionClient & {
  assessment_count?: number;
  latest_assessment_at?: string | null;
};

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function printConsultationReport(params: {
  client: NutritionClient;
  values: CalculatorFormValues;
  result: NutritionCalculationResult;
}) {
  const { client, values, result } = params;
  const html = `
    <!doctype html>
    <html>
      <head>
        <meta charset="utf-8" />
        <title>Phiếu tư vấn dinh dưỡng</title>
        <style>
          body { font-family: Arial, sans-serif; padding: 24px; color: #111827; }
          .wrap { max-width: 840px; margin: 0 auto; }
          h1 { margin: 0 0 6px; font-size: 24px; }
          .muted { color: #6b7280; font-size: 13px; }
          .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin: 16px 0; }
          .box { border: 1px solid #e5e7eb; border-radius: 10px; padding: 12px; }
          .metric { display: flex; justify-content: space-between; border-bottom: 1px solid #f3f4f6; padding: 8px 0; }
          .metric:last-child { border-bottom: 0; }
          .title { color: #6b7280; font-size: 12px; text-transform: uppercase; letter-spacing: .4px; margin-bottom: 8px; }
          .note { white-space: pre-wrap; line-height: 1.6; }
        </style>
      </head>
      <body>
        <div class="wrap">
          <h1>Phiếu tư vấn dinh dưỡng</h1>
          <div class="muted">${escapeHtml(APP_CONFIG.shopName)} - ${new Date().toLocaleString("vi-VN")}</div>
          <div class="grid">
            <div class="box">
              <div class="title">Khách hàng</div>
              <div><strong>${escapeHtml(client.full_name)}</strong></div>
              <div>SĐT: ${escapeHtml(client.phone)}</div>
              <div>Mục tiêu: ${escapeHtml(getNutritionGoalLabel(values.goal))}</div>
              <div>Vận động: ${escapeHtml(getActivityLevelLabel(values.activityLevel))}</div>
            </div>
            <div class="box">
              <div class="title">Chỉ số đầu vào</div>
              <div>Tuổi: ${values.ageYears}</div>
              <div>Chiều cao: ${values.heightCm} cm</div>
              <div>Cân nặng: ${values.weightKg} kg</div>
            </div>
          </div>
          <div class="box">
            <div class="title">Kết quả</div>
            <div class="metric"><span>BMI</span><strong>${result.bmi} - ${escapeHtml(result.bmiCategory)}</strong></div>
            <div class="metric"><span>BMR</span><strong>${formatNumber(result.bmr)} kcal/ngày</strong></div>
            <div class="metric"><span>TDEE</span><strong>${formatNumber(result.tdee)} kcal/ngày</strong></div>
            <div class="metric"><span>Calo mục tiêu</span><strong>${formatNumber(result.targetCalories)} kcal/ngày</strong></div>
            <div class="metric"><span>Macro gợi ý</span><strong>Protein ${result.proteinG}g / Fat ${result.fatG}g / Carb ${result.carbG}g</strong></div>
          </div>
          ${
            values.recommendationText
              ? `<div class="box" style="margin-top:12px;"><div class="title">Khuyến nghị</div><div class="note">${escapeHtml(values.recommendationText)}</div></div>`
              : ""
          }
          ${
            values.doctorNotes
              ? `<div class="box" style="margin-top:12px;"><div class="title">Ghi chú bác sĩ</div><div class="note">${escapeHtml(values.doctorNotes)}</div></div>`
              : ""
          }
          <p class="muted">Kết quả tính toán chỉ mang tính tham khảo, bác sĩ/chuyên gia dinh dưỡng là người đưa khuyến nghị cuối cùng.</p>
        </div>
      </body>
    </html>
  `;

  const iframe = document.createElement("iframe");
  iframe.style.position = "fixed";
  iframe.style.right = "0";
  iframe.style.bottom = "0";
  iframe.style.width = "0";
  iframe.style.height = "0";
  iframe.style.border = "0";
  document.body.appendChild(iframe);
  const doc = iframe.contentDocument || iframe.contentWindow?.document;
  if (!doc) {
    document.body.removeChild(iframe);
    return;
  }
  doc.open();
  doc.write(html);
  doc.close();
  iframe.onload = () => {
    iframe.contentWindow?.focus();
    iframe.contentWindow?.print();
    window.setTimeout(() => {
      if (document.body.contains(iframe)) {
        document.body.removeChild(iframe);
      }
    }, 300);
  };
}

export default function NutritionCalculatorPage() {
  const router = useRouter();
  const [form] = Form.useForm<CalculatorFormValues>();
  const [messageApi, contextHolder] = message.useMessage();
  const [clients, setClients] = useState<ClientOption[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [assessments, setAssessments] = useState<NutritionAssessment[]>([]);
  const [selectedClientId, setSelectedClientId] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  const watchedValues = Form.useWatch([], form);
  const selectedClient = useMemo(
    () => clients.find((item) => item.id === selectedClientId) || null,
    [clients, selectedClientId],
  );

  useEffect(() => {
    const loadData = async () => {
      try {
        const [clientsRes, productsRes] = await Promise.all([
          fetch("/api/admin/nutrition/clients"),
          fetch(`/api/products?activeOnly=true&noCache=1&t=${Date.now()}`, {
            cache: "no-store",
          }),
        ]);
        const [clientsData, productsData] = await Promise.all([
          clientsRes.json(),
          productsRes.json(),
        ]);
        if (!clientsRes.ok) {
          throw new Error(clientsData.error || "Không thể tải khách hàng");
        }
        const loadedClients = Array.isArray(clientsData.clients)
          ? clientsData.clients
          : [];
        setClients(loadedClients);
        setProducts(Array.isArray(productsData) ? productsData : []);

        const params = new URLSearchParams(window.location.search);
        const initialClientId = params.get("clientId") || loadedClients[0]?.id;
        if (initialClientId) {
          setSelectedClientId(initialClientId);
          form.setFieldValue("clientId", initialClientId);
        }
      } catch (error: unknown) {
        messageApi.error(
          error instanceof Error
            ? error.message
            : "Không thể tải dữ liệu calculator",
        );
      } finally {
        setIsLoading(false);
      }
    };

    loadData();
  }, [form, messageApi]);

  useEffect(() => {
    if (!selectedClient) return;
    const age = calculateAgeFromBirthDate(selectedClient.birth_date) || 30;
    form.setFieldsValue({
      clientId: selectedClient.id,
      ageYears: age,
      gender: selectedClient.gender,
      heightCm: selectedClient.height_cm || undefined,
      weightKg: selectedClient.weight_kg || undefined,
      activityLevel: selectedClient.activity_level,
      goal: selectedClient.goal,
      relatedProductIds: [],
    });

    fetch(`/api/admin/nutrition/assessments?clientId=${selectedClient.id}`)
      .then(async (response) => {
        const result = await response.json();
        if (response.ok) {
          setAssessments(
            Array.isArray(result.assessments) ? result.assessments : [],
          );
        }
      })
      .catch(() => setAssessments([]));
  }, [form, selectedClient]);

  const calculationResult = useMemo(() => {
    const values = watchedValues as Partial<CalculatorFormValues> | undefined;
    if (
      !values ||
      !values.ageYears ||
      !values.heightCm ||
      !values.weightKg ||
      !values.gender ||
      !values.activityLevel ||
      !values.goal
    ) {
      return null;
    }

    return calculateNutritionMetrics({
      ageYears: Number(values.ageYears),
      heightCm: Number(values.heightCm),
      weightKg: Number(values.weightKg),
      gender: values.gender,
      activityLevel: values.activityLevel,
      goal: values.goal,
    });
  }, [watchedValues]);

  const productOptions = useMemo(
    () =>
      products.map((item) => ({
        label: `${item.name} - ${formatCurrency(item.price)}`,
        value: item.id,
      })),
    [products],
  );

  const clientOptions = useMemo(
    () =>
      clients.map((item) => ({
        label: `${item.full_name} - ${item.phone}`,
        value: item.id,
      })),
    [clients],
  );

  const saveAssessment = async (values: CalculatorFormValues) => {
    if (!calculationResult) {
      messageApi.warning("Vui lòng nhập đủ thông tin để tính toán");
      return;
    }

    setIsSaving(true);
    try {
      const response = await fetch("/api/admin/nutrition/assessments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...values,
          bmi: calculationResult.bmi,
          bmiCategory: calculationResult.bmiCategory,
          bmr: calculationResult.bmr,
          tdee: calculationResult.tdee,
          targetCalories: calculationResult.targetCalories,
          proteinG: calculationResult.proteinG,
          fatG: calculationResult.fatG,
          carbG: calculationResult.carbG,
        }),
      });
      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.error || "Không thể lưu đánh giá");
      }
      messageApi.success(result.message || "Đã lưu đánh giá");
      if (selectedClientId) {
        const historyRes = await fetch(
          `/api/admin/nutrition/assessments?clientId=${selectedClientId}`,
        );
        if (historyRes.ok) {
          const history = await historyRes.json();
          setAssessments(
            Array.isArray(history.assessments) ? history.assessments : [],
          );
        }
      }
    } catch (error: unknown) {
      messageApi.error(
        error instanceof Error ? error.message : "Không thể lưu đánh giá",
      );
    } finally {
      setIsSaving(false);
    }
  };

  const handlePrint = () => {
    const values = form.getFieldsValue();
    if (!selectedClient || !calculationResult) {
      messageApi.warning("Vui lòng chọn khách và nhập đủ thông tin");
      return;
    }
    printConsultationReport({
      client: selectedClient,
      values,
      result: calculationResult,
    });
  };

  const assessmentColumns: ColumnsType<NutritionAssessment> = [
    {
      title: "Ngày",
      dataIndex: "assessed_at",
      key: "assessed_at",
      render: (value: string) => new Date(value).toLocaleString("vi-VN"),
    },
    {
      title: "BMI",
      key: "bmi",
      render: (_value, record) => (
        <Tag color="blue">
          {record.bmi} - {record.bmi_category}
        </Tag>
      ),
    },
    {
      title: "Calo",
      dataIndex: "target_calories",
      key: "target_calories",
      render: (value: number) => `${formatNumber(value)} kcal`,
    },
    {
      title: "Macro",
      key: "macro",
      render: (_value, record) =>
        `P ${record.protein_g}g / F ${record.fat_g}g / C ${record.carb_g}g`,
    },
  ];

  return (
    <div style={{ minHeight: "100vh", background: "#f5f5f5", padding: 16 }}>
      {contextHolder}

      <Space orientation="vertical" size={16} style={{ width: "100%" }}>
        <Card
          title="Tính toán dinh dưỡng"
          extra={
            <Button
              icon={<UserAddOutlined />}
              onClick={() => router.push("/admin/nutrition/clients")}
            >
              Hồ sơ khách hàng
            </Button>
          }
        >
          <Alert
            type="info"
            showIcon
            style={{ marginBottom: 16 }}
            title="Công cụ hỗ trợ tư vấn"
            description="Công thức Mifflin-St Jeor dùng để tham khảo nhanh. Bác sĩ/chuyên gia có thể điều chỉnh khuyến nghị theo tình trạng thực tế của khách."
          />

          <Form<CalculatorFormValues>
            form={form}
            layout="vertical"
            onFinish={saveAssessment}
            disabled={isLoading}
            initialValues={{
              gender: "female",
              activityLevel: "light",
              goal: "maintain",
            }}
          >
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              <Card size="small" title="Thông tin đầu vào">
                <Form.Item
                  name="clientId"
                  label="Khách hàng"
                  rules={[
                    { required: true, message: "Vui lòng chọn khách hàng" },
                  ]}
                >
                  <Select
                    showSearch
                    placeholder="Chọn khách hàng"
                    options={clientOptions}
                    onChange={setSelectedClientId}
                    filterOption={(input, option) =>
                      String(option?.label || "")
                        .toLowerCase()
                        .includes(input.toLowerCase())
                    }
                  />
                </Form.Item>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <Form.Item
                    name="ageYears"
                    label="Tuổi"
                    rules={[{ required: true, message: "Nhập tuổi" }]}
                  >
                    <InputNumber min={1} max={120} style={{ width: "100%" }} />
                  </Form.Item>
                  <Form.Item name="gender" label="Giới tính">
                    <Select options={GENDER_OPTIONS} />
                  </Form.Item>
                  <Form.Item
                    name="heightCm"
                    label="Chiều cao (cm)"
                    rules={[{ required: true, message: "Nhập chiều cao" }]}
                  >
                    <InputNumber min={1} precision={1} style={{ width: "100%" }} />
                  </Form.Item>
                  <Form.Item
                    name="weightKg"
                    label="Cân nặng (kg)"
                    rules={[{ required: true, message: "Nhập cân nặng" }]}
                  >
                    <InputNumber min={1} precision={1} style={{ width: "100%" }} />
                  </Form.Item>
                </div>

                <Form.Item name="activityLevel" label="Mức vận động">
                  <Select options={ACTIVITY_LEVEL_OPTIONS} />
                </Form.Item>
                <Form.Item name="goal" label="Mục tiêu">
                  <Select options={GOAL_OPTIONS} />
                </Form.Item>
              </Card>

              <Card size="small" title="Kết quả tính nhanh">
                {calculationResult ? (
                  <div className="grid grid-cols-1 gap-3">
                    <Statistic
                      title="BMI"
                      value={calculationResult.bmi}
                      suffix={calculationResult.bmiCategory}
                    />
                    <Statistic
                      title="BMR"
                      value={calculationResult.bmr}
                      suffix="kcal/ngày"
                    />
                    <Statistic
                      title="TDEE"
                      value={calculationResult.tdee}
                      suffix="kcal/ngày"
                    />
                    <Statistic
                      title="Calo mục tiêu"
                      value={calculationResult.targetCalories}
                      suffix="kcal/ngày"
                      styles={{ content: { color: "#1677ff" } }}
                    />
                    <div>
                      <Typography.Text strong>Macro gợi ý</Typography.Text>
                      <div style={{ marginTop: 6 }}>
                        <Tag color="green">
                          Protein {calculationResult.proteinG}g
                        </Tag>
                        <Tag color="gold">Fat {calculationResult.fatG}g</Tag>
                        <Tag color="blue">Carb {calculationResult.carbG}g</Tag>
                      </div>
                    </div>
                  </div>
                ) : (
                  <Typography.Text type="secondary">
                    Nhập tuổi, chiều cao và cân nặng để xem kết quả.
                  </Typography.Text>
                )}
              </Card>

              <Card size="small" title="Ghi chú tư vấn">
                <Form.Item name="recommendationText" label="Khuyến nghị">
                  <Input.TextArea
                    rows={5}
                    placeholder="Ví dụ: ưu tiên protein nạc, rau xanh, hạn chế đồ ngọt..."
                  />
                </Form.Item>
                <Form.Item name="doctorNotes" label="Ghi chú nội bộ">
                  <Input.TextArea rows={4} />
                </Form.Item>
                <Form.Item name="relatedProductIds" label="Sản phẩm gợi ý">
                  <Select
                    mode="multiple"
                    allowClear
                    showSearch
                    options={productOptions}
                    placeholder="Chọn sản phẩm liên quan"
                    filterOption={(input, option) =>
                      String(option?.label || "")
                        .toLowerCase()
                        .includes(input.toLowerCase())
                    }
                  />
                </Form.Item>

                <Space style={{ width: "100%" }}>
                  <Button
                    type="primary"
                    htmlType="submit"
                    icon={<SaveOutlined />}
                    loading={isSaving}
                    disabled={!calculationResult}
                  >
                    Lưu đánh giá
                  </Button>
                  <Button
                    icon={<PrinterOutlined />}
                    onClick={handlePrint}
                    disabled={!calculationResult}
                  >
                    In phiếu
                  </Button>
                </Space>
              </Card>
            </div>
          </Form>
        </Card>

        <Card title="Lịch sử đánh giá gần đây">
          <Table
            rowKey="id"
            dataSource={assessments}
            columns={assessmentColumns}
            pagination={{ pageSize: 5 }}
          />
        </Card>
      </Space>
    </div>
  );
}
