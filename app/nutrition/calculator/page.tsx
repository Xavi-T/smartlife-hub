"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Alert,
  Button,
  Card,
  Form,
  InputNumber,
  Select,
  Space,
  Statistic,
  Tag,
  Typography,
  message,
} from "antd";
import {
  ArrowLeftOutlined,
  CalculatorOutlined,
  InfoCircleOutlined,
  ReadOutlined,
} from "@ant-design/icons";
import { Header } from "@/components/home/Header";
import { CartModal } from "@/components/home/CartModal";
import { ProductGrid } from "@/components/home/ProductGrid";
import { ConsultationRequestCard } from "@/components/nutrition/ConsultationRequestCard";
import { useCart } from "@/hooks/useCart";
import {
  ACTIVITY_LEVEL_OPTIONS,
  GENDER_OPTIONS,
  GOAL_OPTIONS,
  calculateNutritionMetrics,
  type NutritionActivityLevel,
  type NutritionCalculationResult,
  type NutritionGender,
  type NutritionGoal,
} from "@/lib/nutrition";
import { formatNumber } from "@/lib/utils";
import type { Product } from "@/types/database";

interface PublicCalculatorFormValues {
  ageYears: number;
  gender: NutritionGender;
  heightCm: number;
  weightKg: number;
  activityLevel: NutritionActivityLevel;
  goal: NutritionGoal;
}

const METRIC_EXPLANATIONS = [
  {
    title: "BMI",
    subtitle: "Chỉ số khối cơ thể",
    description:
      "BMI giúp ước tính cân nặng hiện tại đang ở mức thiếu cân, bình thường, thừa cân hay béo phì so với chiều cao.",
    note: "BMI chỉ là chỉ số sàng lọc nhanh, chưa phản ánh tỷ lệ mỡ, cơ bắp hoặc tình trạng bệnh lý.",
  },
  {
    title: "BMR",
    subtitle: "Năng lượng cơ bản",
    description:
      "BMR là lượng calo cơ thể cần để duy trì các hoạt động sống cơ bản khi nghỉ ngơi như thở, tuần hoàn và giữ thân nhiệt.",
    note: "Không nên ăn thấp hơn BMR trong thời gian dài nếu không có chuyên gia theo dõi.",
  },
  {
    title: "TDEE",
    subtitle: "Tổng năng lượng tiêu hao",
    description:
      "TDEE là ước tính tổng calo bạn tiêu hao trong một ngày sau khi tính thêm mức vận động, đi lại, làm việc và tập luyện.",
    note: "Muốn duy trì cân nặng, khẩu phần thường sẽ xoay quanh mức TDEE.",
  },
  {
    title: "Calo mục tiêu",
    subtitle: "Mức calo theo mục tiêu",
    description:
      "Calo mục tiêu được điều chỉnh từ TDEE theo mục tiêu giảm cân, duy trì, tăng cân hoặc cải thiện sức khỏe.",
    note: "Giảm hoặc tăng cân nên đi từ từ để cơ thể dễ thích nghi và duy trì lâu dài.",
  },
  {
    title: "Macro",
    subtitle: "Đạm, chất béo, tinh bột",
    description:
      "Macro là gợi ý lượng protein, fat và carb mỗi ngày để bạn dễ chia khẩu phần ăn thành các bữa cụ thể.",
    note: "Bạn không cần cân quá chính xác từng gram, hãy dùng như một mốc tham khảo để chọn thực phẩm.",
  },
  {
    title: "Protein",
    subtitle: "Chất đạm",
    description:
      "Protein hỗ trợ duy trì cơ, tạo cảm giác no và giúp bữa ăn cân bằng hơn, đặc biệt khi giảm cân hoặc tập luyện.",
    note: "Có thể lấy từ thịt, cá, trứng, sữa, đậu phụ, các loại đậu hoặc sản phẩm bổ sung phù hợp.",
  },
];

function getResultTone(result: NutritionCalculationResult) {
  if (result.bmi < 18.5) return "gold";
  if (result.bmi < 23) return "green";
  if (result.bmi < 25) return "orange";
  return "red";
}

function getGoalSuggestion(goal: NutritionGoal) {
  if (goal === "lose_weight") {
    return "Ưu tiên giảm năng lượng vừa phải, tăng rau, giữ đủ đạm và theo dõi cân nặng theo tuần.";
  }
  if (goal === "gain_weight") {
    return "Tăng năng lượng từ bữa chính và bữa phụ, ưu tiên thực phẩm giàu dinh dưỡng thay vì chỉ tăng đồ ngọt.";
  }
  if (goal === "improve_health") {
    return "Giữ bữa ăn cân bằng, giảm đồ uống có đường, tăng vận động đều và theo dõi giấc ngủ.";
  }
  return "Duy trì khẩu phần ổn định, ăn đủ nhóm chất và điều chỉnh theo mức vận động thực tế.";
}

function getSuggestedProducts(products: Product[], goal: NutritionGoal) {
  const keywordMap: Record<NutritionGoal, string[]> = {
    lose_weight: [
      "healthy",
      "ít đường",
      "granola",
      "meal prep",
      "yến mạch",
      "rau",
    ],
    maintain: ["healthy", "meal prep", "dinh dưỡng", "ngũ cốc", "bữa phụ"],
    gain_weight: ["protein", "sữa", "bột", "dinh dưỡng", "hạt", "tăng cân"],
    improve_health: [
      "healthy",
      "ít đường",
      "dinh dưỡng",
      "vitamin",
      "bổ sung",
      "sức khỏe",
    ],
  };
  const keywords = keywordMap[goal];

  return [...products]
    .map((product) => {
      const haystack = `${product.name} ${product.category} ${
        product.description || ""
      }`.toLowerCase();
      const score = keywords.reduce(
        (total, keyword) => total + (haystack.includes(keyword) ? 1 : 0),
        0,
      );
      return { product, score };
    })
    .filter((item) => item.score > 0 && item.product.stock_quantity > 0)
    .sort((first, second) => second.score - first.score)
    .slice(0, 4)
    .map((item) => item.product);
}

export default function PublicNutritionCalculatorPage() {
  const router = useRouter();
  const [form] = Form.useForm<PublicCalculatorFormValues>();
  const [messageApi, contextHolder] = message.useMessage();
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [products, setProducts] = useState<Product[]>([]);
  const watchedValues = Form.useWatch([], form);
  const {
    cart,
    addToCart,
    updateQuantity,
    removeFromCart,
    getTotalItems,
    getTotalPrice,
  } = useCart();

  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/products?activeOnly=true", {
      signal: controller.signal,
    })
      .then(async (response) => {
        if (!response.ok) return [];
        const result = await response.json();
        return Array.isArray(result) ? result : [];
      })
      .then((items) => {
        if (!controller.signal.aborted) setProducts(items);
      })
      .catch((error) => {
        if (!controller.signal.aborted) {
          console.error("Error loading suggested products:", error);
        }
      });

    return () => controller.abort();
  }, []);

  const calculationResult = useMemo(() => {
    const values =
      watchedValues as Partial<PublicCalculatorFormValues> | undefined;
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

  const currentGoal = watchedValues?.goal || "maintain";
  const suggestedProducts = useMemo(
    () => getSuggestedProducts(products, currentGoal).slice(0, 4),
    [currentGoal, products],
  );
  const consultationCalculation = useMemo(() => {
    const values =
      watchedValues as Partial<PublicCalculatorFormValues> | undefined;
    if (!values || !calculationResult) return null;
    return {
      ageYears: values.ageYears,
      gender: values.gender,
      heightCm: values.heightCm,
      weightKg: values.weightKg,
      activityLevel: values.activityLevel,
      goal: values.goal,
      result: calculationResult,
    };
  }, [calculationResult, watchedValues]);

  const handleAddToCart = (product: Product) => {
    addToCart(product);
    messageApi.success("Đã thêm vào giỏ hàng");
  };

  const handleViewProduct = (product: Product) => {
    router.push(`/products/${product.id}`);
  };

  return (
    <div className="sl-public-shell">
      {contextHolder}
      <Header
        cartItemsCount={getTotalItems()}
        onCartClick={() => setIsCartOpen(true)}
      />

      <main className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-4 sm:py-6 pb-36 md:pb-8">
        <Button
          icon={<ArrowLeftOutlined />}
          onClick={() => router.push("/nutrition")}
          style={{ marginBottom: 16 }}
        >
          Bài viết dinh dưỡng
        </Button>

        <div className="sl-animate-in mb-5">
          <Typography.Title
            level={1}
            className="sl-section-title !mb-0 !text-[28px] sm:!text-[38px]"
          >
            Tính nhu cầu dinh dưỡng
          </Typography.Title>
          <Typography.Paragraph
            type="secondary"
            style={{ marginTop: 8, maxWidth: 780 }}
          >
            Ước tính BMI, BMR, TDEE, calo mục tiêu và macro gợi ý theo thông
            tin cá nhân.
          </Typography.Paragraph>
        </div>

        <Alert
          className="sl-animate-in sl-animate-delay-1"
          type="info"
          showIcon
          style={{ marginBottom: 16 }}
          title="Kết quả tham khảo"
          description="Công cụ dùng công thức Mifflin-St Jeor để ước tính nhanh, không thay thế tư vấn y khoa khi bạn có bệnh lý nền, đang mang thai hoặc cần chế độ ăn điều trị."
        />

        <div className="sl-animate-in sl-animate-delay-2 grid grid-cols-1 lg:grid-cols-3 gap-4">
          <Card
            title={
              <Space>
                <CalculatorOutlined />
                <span>Thông tin của bạn</span>
              </Space>
            }
            className="lg:col-span-1"
            styles={{ body: { padding: 16 } }}
          >
            <Form<PublicCalculatorFormValues>
              form={form}
              layout="vertical"
              initialValues={{
                gender: "female",
                activityLevel: "light",
                goal: "maintain",
              }}
            >
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-1 gap-x-3">
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
            </Form>
          </Card>

          <Card
            title="Kết quả"
            className="lg:col-span-2"
            styles={{ body: { padding: 16 } }}
            extra={
              <Button
                icon={<ReadOutlined />}
                onClick={() => router.push("/nutrition")}
              >
                Đọc thêm
              </Button>
            }
          >
            {calculationResult ? (
              <Space orientation="vertical" size={16} style={{ width: "100%" }}>
                <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
                  <div className="rounded-lg border border-gray-200 bg-white p-3">
                    <Statistic
                      title="BMI"
                      value={calculationResult.bmi}
                    />
                    <Tag
                      color={getResultTone(calculationResult)}
                      style={{ marginTop: 6 }}
                    >
                      {calculationResult.bmiCategory}
                    </Tag>
                  </div>
                  <div className="rounded-lg border border-gray-200 bg-white p-3">
                    <Statistic
                      title="BMR"
                      value={formatNumber(calculationResult.bmr)}
                      suffix="kcal/ngày"
                    />
                  </div>
                  <div className="rounded-lg border border-gray-200 bg-white p-3">
                    <Statistic
                      title="TDEE"
                      value={formatNumber(calculationResult.tdee)}
                      suffix="kcal/ngày"
                    />
                  </div>
                  <div className="rounded-lg border border-gray-200 bg-white p-3">
                    <Statistic
                      title="Calo mục tiêu"
                      value={formatNumber(calculationResult.targetCalories)}
                      suffix="kcal/ngày"
                      styles={{ content: { color: "#1677ff" } }}
                    />
                  </div>
                </div>

                <section className="rounded-lg border border-gray-200 bg-white p-3">
                  <Typography.Title level={5} style={{ marginTop: 0 }}>
                    Macro gợi ý mỗi ngày
                  </Typography.Title>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <Statistic
                      title="Protein"
                      value={calculationResult.proteinG}
                      suffix="g"
                      styles={{ content: { color: "#389e0d" } }}
                    />
                    <Statistic
                      title="Chất béo"
                      value={calculationResult.fatG}
                      suffix="g"
                      styles={{ content: { color: "#d48806" } }}
                    />
                    <Statistic
                      title="Tinh bột"
                      value={calculationResult.carbG}
                      suffix="g"
                      styles={{ content: { color: "#1677ff" } }}
                    />
                  </div>
                </section>

                <Alert
                  type="success"
                  showIcon
                  title="Gợi ý nhanh"
                  description={getGoalSuggestion(currentGoal)}
                />
              </Space>
            ) : (
              <div style={{ padding: "40px 0", textAlign: "center" }}>
                <Typography.Text type="secondary">
                  Nhập tuổi, chiều cao và cân nặng để xem kết quả.
                </Typography.Text>
              </div>
            )}
          </Card>
        </div>

        <div className="mt-4">
          <ConsultationRequestCard
            source="nutrition_calculator"
            title="Gửi chỉ số để được tư vấn"
            description="Thông tin bạn vừa tính sẽ được lưu vào hồ sơ tư vấn và gửi email cho SmartLife Hub."
            defaultMessage="Tôi muốn được tư vấn chế độ ăn và sản phẩm phù hợp theo các chỉ số vừa tính."
            calculation={consultationCalculation}
          />
        </div>

        {suggestedProducts.length > 0 && (
          <Card
            className="sl-animate-in sl-animate-delay-3"
            style={{ marginTop: 16 }}
            styles={{ body: { padding: 16 } }}
            title="Sản phẩm gợi ý theo mục tiêu"
          >
            <ProductGrid
              products={suggestedProducts}
              onAddToCart={handleAddToCart}
              onViewDetail={handleViewProduct}
            />
          </Card>
        )}

        <Card
          className="sl-animate-in sl-animate-delay-3"
          style={{ marginTop: 16 }}
          styles={{ body: { padding: 16 } }}
          title={
            <Space>
              <InfoCircleOutlined />
              <span>Hiểu các chỉ số</span>
            </Space>
          }
        >
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
            {METRIC_EXPLANATIONS.map((item) => (
              <section
                key={item.title}
                className="rounded-lg border border-gray-200 bg-white p-3"
              >
                <div className="mb-2 flex flex-wrap items-center gap-2">
                  <Tag color="blue" style={{ margin: 0 }}>
                    {item.title}
                  </Tag>
                  <Typography.Text strong>{item.subtitle}</Typography.Text>
                </div>
                <Typography.Paragraph
                  type="secondary"
                  style={{ marginBottom: 8 }}
                >
                  {item.description}
                </Typography.Paragraph>
                <Typography.Text type="secondary" style={{ fontSize: 13 }}>
                  {item.note}
                </Typography.Text>
              </section>
            ))}
          </div>
        </Card>
      </main>

      <CartModal
        isOpen={isCartOpen}
        onClose={() => setIsCartOpen(false)}
        cart={cart}
        onUpdateQuantity={updateQuantity}
        onRemoveItem={removeFromCart}
        onCheckout={() => {
          setIsCartOpen(false);
          router.push("/checkout");
        }}
        totalPrice={getTotalPrice()}
      />
    </div>
  );
}
