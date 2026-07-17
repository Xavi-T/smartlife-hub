"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { CopyOutlined } from "@ant-design/icons";
import {
  Alert,
  Button,
  Card,
  Empty,
  Form,
  Image,
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
import { buildVietQrUrl } from "@/lib/vietqr";

interface CheckoutFormValues {
  name: string;
  phone: string;
  address?: string;
  notes?: string;
  voucherCode?: string;
  checkoutMethod: CheckoutMethod;
}

export default function CheckoutPage() {
  const router = useRouter();
  const [form] = Form.useForm<CheckoutFormValues>();
  const [messageApi, contextHolder] = message.useMessage();
  const { cart, updateQuantity, removeFromCart, clearCart, isLoaded } =
    useCart();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isCheckingVoucher, setIsCheckingVoucher] = useState(false);
  const [appliedVoucherCode, setAppliedVoucherCode] = useState("");
  const [voucherDiscountAmount, setVoucherDiscountAmount] = useState(0);
  const hasTrackedBeginCheckout = useRef(false);

  const examplePhone = useMemo(
    () => APP_CONFIG.shopPhone.replace(/\D/g, "") || "0901234567",
    [],
  );

  const checkoutMethod = Form.useWatch("checkoutMethod", form) || "cod";
  const customerName = Form.useWatch("name", form) || "";
  const customerPhone = Form.useWatch("phone", form) || "";
  const voucherCode = Form.useWatch("voucherCode", form) || "";
  const totalPrice = useMemo(
    () =>
      cart.reduce((sum, item) => sum + item.product.price * item.quantity, 0),
    [cart],
  );
  const finalTotalPrice = Math.max(0, totalPrice - voucherDiscountAmount);

  const splitProductAndVariant = (cartProductId: string) => {
    const [productId, variantId] = String(cartProductId || "").split("::");
    return {
      productId,
      variantId: variantId || undefined,
    };
  };

  const transferContent = useMemo(() => {
    const cleanName = String(customerName || "")
      .trim()
      .replace(/\s+/g, " ");
    const cleanPhone = String(customerPhone || "").trim();
    const result = `${cleanName}-${cleanPhone}`.trim();
    return result || "Ten KH + SDT";
  }, [customerName, customerPhone]);

  const bankQrSrc = useMemo(() => {
    return buildVietQrUrl({
      bankName: APP_CONFIG.bank.name,
      accountNo: APP_CONFIG.bank.accountNumber,
      amount: Math.round(finalTotalPrice),
      addInfo: transferContent,
      accountName: APP_CONFIG.bank.accountName,
      template: "compact2",
    }).qr_url;
  }, [finalTotalPrice, transferContent]);

  const handleCopy = async (value: string, label: string) => {
    try {
      if (!value) {
        messageApi.warning(`Chưa có ${label.toLowerCase()} để copy`);
        return;
      }
      await navigator.clipboard.writeText(value);
      messageApi.success(`Đã copy ${label.toLowerCase()}`);
    } catch {
      messageApi.error("Không thể copy, vui lòng thử lại");
    }
  };

  const handleApplyVoucher = async () => {
    const code = String(voucherCode || "")
      .trim()
      .toUpperCase();
    if (!code) {
      messageApi.warning("Vui lòng nhập mã voucher");
      return;
    }

    setIsCheckingVoucher(true);
    try {
      const response = await fetch("/api/vouchers/preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          voucherCode: code,
          customerPhone,
          orderAmount: totalPrice,
        }),
      });
      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Voucher không hợp lệ");
      }

      setAppliedVoucherCode(code);
      setVoucherDiscountAmount(Number(result.discountAmount || 0));
      form.setFieldValue("voucherCode", code);
      messageApi.success("Đã áp dụng voucher");
    } catch (error) {
      setAppliedVoucherCode("");
      setVoucherDiscountAmount(0);
      messageApi.error(
        error instanceof Error ? error.message : "Không thể áp dụng voucher",
      );
    } finally {
      setIsCheckingVoucher(false);
    }
  };

  const handleClearVoucher = () => {
    setAppliedVoucherCode("");
    setVoucherDiscountAmount(0);
    form.setFieldValue("voucherCode", undefined);
  };

  useEffect(() => {
    if (!isLoaded || cart.length === 0 || hasTrackedBeginCheckout.current) {
      return;
    }

    trackBeginCheckout(cart);
    hasTrackedBeginCheckout.current = true;
  }, [cart, isLoaded]);

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
        paymentMethod: "bank_transfer",
        voucherCode: appliedVoucherCode || undefined,
        items: cart.map((item) => ({
          product_id: splitProductAndVariant(item.product.id).productId,
          variant_id: splitProductAndVariant(item.product.id).variantId,
          quantity: item.quantity,
        })),
      });

      if (result.success) {
        trackPurchase({
          transactionId: result.orderId || `order-${Date.now()}`,
          value: Number(result.totalAmount || finalTotalPrice),
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
      <div className="sl-public-shell flex items-center justify-center">
        <Typography.Text type="secondary">Đang tải giỏ hàng...</Typography.Text>
      </div>
    );
  }

  return (
    <div className="sl-public-shell">
      {contextHolder}
      <Header
        cartItemsCount={cart.length}
        onCartClick={() => router.push("/")}
      />

      <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 pb-36 md:pb-0">
        <div className="py-8">
          <Typography.Title
            level={1}
            className="sl-section-title mb-2! text-[30px]! sm:text-[40px]!"
          >
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

                <Form.Item label="Mã voucher" name="voucherCode">
                  <Space.Compact style={{ width: "100%" }}>
                    <Input
                      placeholder="Nhập mã voucher nếu có"
                      onChange={() => {
                        if (appliedVoucherCode) {
                          setAppliedVoucherCode("");
                          setVoucherDiscountAmount(0);
                        }
                      }}
                    />
                    <Button
                      loading={isCheckingVoucher}
                      onClick={handleApplyVoucher}
                    >
                      Áp dụng
                    </Button>
                    {appliedVoucherCode && (
                      <Button onClick={handleClearVoucher}>Xóa</Button>
                    )}
                  </Space.Compact>
                </Form.Item>

                {appliedVoucherCode && (
                  <Alert
                    type="success"
                    showIcon
                    style={{ marginBottom: 16 }}
                    message={`Đã áp dụng voucher ${appliedVoucherCode}`}
                    description={`Giảm ${formatCurrency(voucherDiscountAmount)} cho đơn hàng này.`}
                  />
                )}

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
                            <div
                              style={{
                                display: "flex",
                                alignItems: "center",
                                gap: 8,
                                flexWrap: "wrap",
                              }}
                            >
                              <span>Ngân hàng: {APP_CONFIG.bank.name}</span>
                              <Button
                                size="small"
                                icon={<CopyOutlined />}
                                onClick={() =>
                                  handleCopy(
                                    APP_CONFIG.bank.name,
                                    "Tên ngân hàng",
                                  )
                                }
                              >
                                Copy
                              </Button>
                            </div>
                            <div
                              style={{
                                display: "flex",
                                alignItems: "center",
                                gap: 8,
                                flexWrap: "wrap",
                              }}
                            >
                              <span>
                                Số tài khoản: {APP_CONFIG.bank.accountNumber}
                              </span>
                              <Button
                                size="small"
                                icon={<CopyOutlined />}
                                onClick={() =>
                                  handleCopy(
                                    APP_CONFIG.bank.accountNumber,
                                    "Số tài khoản",
                                  )
                                }
                              >
                                Copy
                              </Button>
                            </div>
                            <div>
                              Chủ tài khoản: {APP_CONFIG.bank.accountName}
                            </div>
                            <div
                              style={{
                                marginTop: 6,
                                display: "flex",
                                alignItems: "center",
                                gap: 8,
                                flexWrap: "wrap",
                              }}
                            >
                              <span>
                                Nội dung CK: <strong>{transferContent}</strong>{" "}
                                (Không bắt buộc)
                              </span>
                              <Button
                                size="small"
                                icon={<CopyOutlined />}
                                onClick={() =>
                                  handleCopy(
                                    transferContent,
                                    "Nội dung chuyển khoản",
                                  )
                                }
                              >
                                Copy
                              </Button>
                            </div>
                          </div>
                          <div>
                            <Image
                              src={bankQrSrc}
                              alt="Mã QR chuyển khoản"
                              preview={{
                                mask: "Nhấn để xem ảnh lớn",
                              }}
                              style={{
                                width: "min(220px, 100%)",
                                aspectRatio: "1 / 1",
                                objectFit: "contain",
                                borderRadius: 8,
                                border: "1px solid #d9d9d9",
                                background: "#fff",
                              }}
                            />
                            <Typography.Text
                              type="secondary"
                              style={{
                                display: "block",
                                maxWidth: 220,
                                marginTop: 6,
                                fontSize: 12,
                                textAlign: "center",
                              }}
                            >
                              QR đã kèm số tiền và nội dung chuyển khoản.
                            </Typography.Text>
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
                    {formatCurrency(totalPrice)}
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
                {voucherDiscountAmount > 0 && (
                  <div
                    style={{ display: "flex", justifyContent: "space-between" }}
                  >
                    <Typography.Text>
                      Voucher {appliedVoucherCode}
                    </Typography.Text>
                    <Typography.Text strong style={{ color: "#cf1322" }}>
                      -{formatCurrency(voucherDiscountAmount)}
                    </Typography.Text>
                  </div>
                )}
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    borderTop: "1px solid #f0f0f0",
                    paddingTop: 10,
                  }}
                >
                  <Typography.Text strong>Tổng thanh toán</Typography.Text>
                  <Typography.Text strong style={{ color: "#1677ff" }}>
                    {formatCurrency(finalTotalPrice)}
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
