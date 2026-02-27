"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Alert,
  Button,
  Card,
  Empty,
  Form,
  Input,
  Radio,
  Space,
  Steps,
  Tag,
  Typography,
  message,
} from "antd";
import { Header } from "@/components/home/Header";
import { useCart } from "@/hooks/useCart";
import { createOrder, checkStockAvailability } from "@/actions/orders";
import { formatCurrency } from "@/lib/utils";
import type { CheckoutMethod } from "@/types/order";
import { trackBeginCheckout, trackPurchase } from "@/lib/analytics";
import { APP_CONFIG } from "@/lib/appConfig";

interface CheckoutFormValues {
  name: string;
  phone: string;
  address?: string;
  notes?: string;
  checkoutMethod: CheckoutMethod;
}

export default function CheckoutPage() {
  const router = useRouter();
  const [form] = Form.useForm<CheckoutFormValues>();
  const [messageApi, contextHolder] = message.useMessage();
  const {
    cart,
    updateQuantity,
    removeFromCart,
    clearCart,
    getTotalPrice,
    isLoaded,
  } = useCart();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [bankQrSrc, setBankQrSrc] = useState("/qrcode.png");
  const hasTrackedBeginCheckout = useRef(false);

  const examplePhone = useMemo(
    () => APP_CONFIG.shopPhone.replace(/\D/g, "") || "0901234567",
    [],
  );

  const checkoutMethod = Form.useWatch("checkoutMethod", form) || "cod";

  const splitProductAndVariant = (cartProductId: string) => {
    const [productId, variantId] = String(cartProductId || "").split("::");
    return {
      productId,
      variantId: variantId || undefined,
    };
  };

  useEffect(() => {
    if (!isLoaded || cart.length === 0 || hasTrackedBeginCheckout.current) {
      return;
    }

    trackBeginCheckout(cart);
    hasTrackedBeginCheckout.current = true;
  }, [cart, isLoaded]);

  useEffect(() => {
    let active = true;

    const loadBankQrCode = async () => {
      try {
        const response = await fetch("/api/media?purpose=bank_qrcode", {
          cache: "no-store",
        });

        if (!response.ok) return;

        const result = await response.json();
        const firstQrCode = Array.isArray(result.media) ? result.media[0] : null;

        if (active && firstQrCode?.image_url) {
          setBankQrSrc(firstQrCode.image_url);
        }
      } catch {
        // Keep default QR code fallback
      }
    };

    loadBankQrCode();

    return () => {
      active = false;
    };
  }, []);

  const stepItems = useMemo(
    () => [
      {
        title: "Kiểm tra đơn hàng",
        content: "Xác nhận sản phẩm, số lượng và tổng tiền",
      },
      {
        title: "Thông tin nhận hàng",
        content: "Điền SĐT và thông tin liên hệ",
      },
      {
        title: "Chọn hình thức đặt hàng",
        content: "Ship COD hoặc chuyển khoản",
      },
      {
        title: "Xác nhận",
        content: "Tạo đơn hàng và chuyển sang trang kiểm tra",
      },
    ],
    [],
  );

  const handleSubmit = async (values: CheckoutFormValues) => {
    if (cart.length === 0) {
      messageApi.error("Giỏ hàng đang trống");
      return;
    }

    setIsSubmitting(true);

    try {
      const stockCheck = await checkStockAvailability(
        cart.map((item) => ({
          product_id: splitProductAndVariant(item.product.id).productId,
          variant_id: splitProductAndVariant(item.product.id).variantId,
          quantity: item.quantity,
        })),
      );

      if (!stockCheck.available) {
        messageApi.error(stockCheck.message || "Kiểm tra tồn kho thất bại");
        return;
      }

      const result = await createOrder({
        customer: {
          name: values.name,
          phone: values.phone,
          address: values.address,
          notes: values.notes,
        },
        checkoutMethod: values.checkoutMethod,
        paymentMethod:
          values.checkoutMethod === "bank_transfer" ? "bank_transfer" : "cod",
        items: cart.map((item) => ({
          product_id: splitProductAndVariant(item.product.id).productId,
          variant_id: splitProductAndVariant(item.product.id).variantId,
          quantity: item.quantity,
        })),
      });

      if (result.success) {
        trackPurchase({
          transactionId: result.orderId || `order-${Date.now()}`,
          value: Number(result.totalAmount || getTotalPrice()),
          paymentType: values.checkoutMethod,
          items: cart,
        });

        messageApi.success("Đặt hàng thành công");
        const normalizedPhone = values.phone.replace(/\D/g, "");
        clearCart();
        router.push(
          `/orders/track?phone=${encodeURIComponent(normalizedPhone)}&created=1`,
        );
      } else {
        messageApi.error(result.message);
      }
    } catch (error) {
      console.error("Error:", error);
      messageApi.error("Đã xảy ra lỗi không mong muốn");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isLoaded) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Typography.Text type="secondary">Đang tải giỏ hàng...</Typography.Text>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {contextHolder}
      <Header
        cartItemsCount={cart.length}
        onCartClick={() => router.push("/")}
      />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="py-8">
          <Typography.Title level={2} style={{ marginBottom: 8 }}>
            Thanh toán đơn hàng
          </Typography.Title>
          <Typography.Text type="secondary">
            Hoàn tất đơn theo từng bước, sau đó kiểm tra tình trạng bằng số điện
            thoại.
          </Typography.Text>
        </div>

        <Card style={{ marginBottom: 20 }}>
          <Steps
            responsive
            items={stepItems}
            current={cart.length > 0 ? 2 : 0}
          />
        </Card>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 pb-10">
          <div className="lg:col-span-2">
            <Card
              title="Bước 1: Kiểm tra giỏ hàng"
              style={{ marginBottom: 16 }}
            >
              {cart.length === 0 ? (
                <Empty
                  description="Giỏ hàng đang trống"
                  image={Empty.PRESENTED_IMAGE_SIMPLE}
                >
                  <Button type="primary" onClick={() => router.push("/")}>
                    Về trang sản phẩm
                  </Button>
                </Empty>
              ) : (
                <Space
                  orientation="vertical"
                  size={12}
                  style={{ width: "100%" }}
                >
                  {cart.map((item) => (
                    <div
                      key={item.product.id}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        borderBottom: "1px solid #f0f0f0",
                        paddingBottom: 10,
                      }}
                    >
                      <div style={{ minWidth: 0 }}>
                        <Typography.Text strong>
                          {item.product.name}
                        </Typography.Text>
                        <br />
                        <Typography.Text type="secondary">
                          {formatCurrency(item.product.price)} × {item.quantity}
                        </Typography.Text>
                      </div>
                      <Space>
                        <Button
                          size="small"
                          onClick={() =>
                            updateQuantity(item.product.id, item.quantity - 1)
                          }
                        >
                          -
                        </Button>
                        <Tag>{item.quantity}</Tag>
                        <Button
                          size="small"
                          onClick={() =>
                            updateQuantity(item.product.id, item.quantity + 1)
                          }
                          disabled={
                            item.quantity >= item.product.stock_quantity
                          }
                        >
                          +
                        </Button>
                        <Button
                          size="small"
                          danger
                          type="text"
                          onClick={() => removeFromCart(item.product.id)}
                        >
                          Xóa
                        </Button>
                      </Space>
                    </div>
                  ))}
                </Space>
              )}
            </Card>

            <Card title="Bước 2 & 3: Thông tin và hình thức đặt hàng">
              <Form<CheckoutFormValues>
                form={form}
                layout="vertical"
                onFinish={handleSubmit}
                initialValues={{
                  checkoutMethod: "cod",
                }}
              >
                <Form.Item
                  label="Họ và tên"
                  name="name"
                  rules={[{ required: true, message: "Vui lòng nhập họ tên" }]}
                >
                  <Input placeholder="Nguyễn Văn A" />
                </Form.Item>

                <Form.Item
                  label="Số điện thoại"
                  name="phone"
                  rules={[
                    { required: true, message: "Vui lòng nhập số điện thoại" },
                    {
                      pattern: /^[0-9+\s().-]{10,}$/,
                      message: "Số điện thoại không hợp lệ",
                    },
                  ]}
                >
                  <Input placeholder={examplePhone} />
                </Form.Item>

                <Form.Item
                  label="Hình thức đặt hàng"
                  name="checkoutMethod"
                  rules={[{ required: true }]}
                >
                  <Radio.Group style={{ width: "100%" }}>
                    <Space orientation="vertical" style={{ width: "100%" }}>
                      <Radio value="cod">
                        Ship COD (thanh toán khi nhận hàng)
                      </Radio>
                      <Radio value="bank_transfer">Chuyển khoản ngay</Radio>
                    </Space>
                  </Radio.Group>
                </Form.Item>

                {checkoutMethod === "bank_transfer" && (
                  <>
                    <Alert
                      type="info"
                      showIcon
                      title="Thông tin chuyển khoản"
                      description={
                        <div
                          style={{
                            display: "flex",
                            gap: 16,
                            alignItems: "flex-start",
                            flexWrap: "wrap",
                          }}
                        >
                          <div style={{ flex: 1, minWidth: 220 }}>
                            <div>Ngân hàng: {APP_CONFIG.bank.name}</div>
                            <div>Số tài khoản: {APP_CONFIG.bank.accountNumber}</div>
                            <div>Chủ tài khoản: {APP_CONFIG.bank.accountName}</div>
                            <div style={{ marginTop: 6 }}>
                              Nội dung CK: <strong>SDT của bạn</strong>
                            </div>
                          </div>
                          <div>
                            <img
                              src={bankQrSrc}
                              alt="Mã QR chuyển khoản"
                              loading="lazy"
                              style={{
                                width: "clamp(170px, 24vw, 220px)",
                                height: "clamp(170px, 24vw, 220px)",
                                objectFit: "contain",
                                borderRadius: 8,
                                border: "1px solid #d9d9d9",
                                background: "#fff",
                              }}
                            />
                          </div>
                        </div>
                      }
                      style={{ marginBottom: 16 }}
                    />
                    <Form.Item
                      label="Địa chỉ giao hàng"
                      name="address"
                      rules={[
                        {
                          required: true,
                          message: "Vui lòng nhập địa chỉ giao hàng",
                        },
                      ]}
                    >
                      <Input.TextArea
                        rows={3}
                        placeholder="123 Nguyễn Huệ, Quận 1, TP.HCM"
                      />
                    </Form.Item>
                  </>
                )}

                {checkoutMethod === "cod" && (
                  <Form.Item label="Địa chỉ giao hàng" name="address">
                    <Input.TextArea
                      rows={3}
                      placeholder="Nhập địa chỉ giao hàng của bạn"
                    />
                  </Form.Item>
                )}

                <Form.Item label="Ghi chú" name="notes">
                  <Input.TextArea
                    rows={2}
                    placeholder="Ghi chú thêm cho đơn hàng"
                  />
                </Form.Item>

                <Button
                  type="primary"
                  htmlType="submit"
                  size="large"
                  block
                  loading={isSubmitting}
                  disabled={cart.length === 0}
                >
                  Bước 4: Xác nhận đặt hàng
                </Button>
              </Form>
            </Card>
          </div>

          <div className="lg:col-span-1">
            <Card
              title="Tóm tắt thanh toán"
              style={{ position: "sticky", top: 24 }}
            >
              <Space orientation="vertical" style={{ width: "100%" }} size={10}>
                <div
                  style={{ display: "flex", justifyContent: "space-between" }}
                >
                  <Typography.Text>Tạm tính</Typography.Text>
                  <Typography.Text>
                    {formatCurrency(getTotalPrice())}
                  </Typography.Text>
                </div>
                <div
                  style={{ display: "flex", justifyContent: "space-between" }}
                >
                  <Typography.Text>Phí vận chuyển</Typography.Text>
                  <Typography.Text strong style={{ color: "#52c41a" }}>
                    Miễn phí
                  </Typography.Text>
                </div>
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    borderTop: "1px solid #f0f0f0",
                    paddingTop: 10,
                  }}
                >
                  <Typography.Text strong>Tổng tạm tính</Typography.Text>
                  <Typography.Text strong style={{ color: "#1677ff" }}>
                    {formatCurrency(getTotalPrice())}
                  </Typography.Text>
                </div>
                <Alert
                  type="warning"
                  showIcon
                  title="Sau khi đặt hàng"
                  description="Hệ thống sẽ chuyển bạn tới trang kiểm tra đơn hàng để theo dõi trạng thái bằng SĐT."
                />
              </Space>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
