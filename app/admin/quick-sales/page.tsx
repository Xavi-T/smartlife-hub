"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Badge,
  Button,
  Card,
  Divider,
  Form,
  Input,
  InputNumber,
  Modal,
  Select,
  Space,
  Switch,
  Tag,
  Typography,
  message,
} from "antd";
import {
  DeleteOutlined,
  MinusOutlined,
  PlusOutlined,
  PrinterOutlined,
  ReloadOutlined,
  SearchOutlined,
  ShoppingCartOutlined,
} from "@ant-design/icons";
import { createOrder } from "@/actions/orders";
import {
  calculateDiscountedPrice,
  formatCurrency,
  getEffectiveDiscountPercent,
} from "@/lib/utils";
import { buildInvoiceHtml, printInvoiceHtml } from "@/lib/invoice";
import type { Product } from "@/types/database";

const { TextArea } = Input;
const { Text, Title } = Typography;

interface QuickSalesForm {
  customerName: string;
  customerPhone: string;
  customerAddress?: string;
  notes?: string;
  discountEnabled?: boolean;
  discountPercent?: number;
  discountMode?: "order_total" | "product_items";
  discountProductPercents?: Record<string, number | undefined>;
}

interface CartItem {
  product: Product;
  quantity: number;
}

interface RecentOrderItem {
  id: string;
  quantity: number;
  unit_price: number;
  subtotal: number;
  products: {
    name: string;
  };
}

interface RecentOrder {
  id: string;
  customer_name: string;
  customer_phone: string;
  customer_address: string;
  total_amount: number;
  notes: string | null;
  created_at: string;
  order_items: RecentOrderItem[];
}

export default function QuickSalesPage() {
  const [form] = Form.useForm<QuickSalesForm>();
  const [messageApi, contextHolder] = message.useMessage();
  const [products, setProducts] = useState<Product[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [recentOrders, setRecentOrders] = useState<RecentOrder[]>([]);
  const [isLoadingProducts, setIsLoadingProducts] = useState(true);
  const [isLoadingRecentOrders, setIsLoadingRecentOrders] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const discountEnabledWatch = Boolean(Form.useWatch("discountEnabled", form));
  const discountPercentWatch = Number(
    Form.useWatch("discountPercent", form) || 0,
  );
  const discountModeWatch =
    (Form.useWatch("discountMode", form) as
      | "order_total"
      | "product_items"
      | undefined) || "order_total";
  const discountProductPercentsWatch =
    (Form.useWatch("discountProductPercents", form) as
      | Record<string, number | undefined>
      | undefined) || {};
  const appliedDiscountPercent = discountEnabledWatch
    ? Math.min(100, Math.max(0, discountPercentWatch))
    : 0;

  const productDiscountPercentMap = useMemo(() => {
    const entries = Object.entries(discountProductPercentsWatch).map(
      ([productId, percent]) => [
        productId,
        Math.min(100, Math.max(0, Number(percent || 0))),
      ],
    );
    return Object.fromEntries(entries) as Record<string, number>;
  }, [discountProductPercentsWatch]);

  const discountedProductCount = useMemo(
    () =>
      cart.filter(
        (item) => (productDiscountPercentMap[item.product.id] || 0) > 0,
      ).length,
    [cart, productDiscountPercentMap],
  );

  useEffect(() => {
    const cartIds = new Set(cart.map((item) => item.product.id));
    const nextPercents = Object.fromEntries(
      Object.entries(discountProductPercentsWatch).filter(([productId]) =>
        cartIds.has(productId),
      ),
    );

    if (
      Object.keys(nextPercents).length !==
      Object.keys(discountProductPercentsWatch).length
    ) {
      form.setFieldValue("discountProductPercents", nextPercents);
    }
  }, [cart, discountProductPercentsWatch, form]);

  useEffect(() => {
    const fetchProducts = async () => {
      try {
        const res = await fetch(
          `/api/products?activeOnly=true&noCache=1&t=${Date.now()}`,
          { cache: "no-store" },
        );
        if (!res.ok) throw new Error("Không thể tải sản phẩm");
        const data = (await res.json()) as Product[];
        setProducts(data.filter((product) => product.stock_quantity > 0));
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : "Không thể tải sản phẩm";
        messageApi.error(errorMessage);
      } finally {
        setIsLoadingProducts(false);
      }
    };

    fetchProducts();
  }, [messageApi]);

  const fetchRecentOrders = async () => {
    try {
      setIsLoadingRecentOrders(true);
      const res = await fetch("/api/admin/orders");
      if (!res.ok) throw new Error("Không thể tải đơn hàng gần đây");
      const data = (await res.json()) as RecentOrder[];
      setRecentOrders((data || []).slice(0, 5));
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Không thể tải đơn gần đây";
      messageApi.error(errorMessage);
    } finally {
      setIsLoadingRecentOrders(false);
    }
  };

  useEffect(() => {
    fetchRecentOrders();
  }, []);

  const filteredProducts = useMemo(() => {
    const keyword = searchQuery.trim().toLowerCase();
    if (!keyword) return products;

    return products.filter(
      (product) =>
        product.name.toLowerCase().includes(keyword) ||
        product.category.toLowerCase().includes(keyword),
    );
  }, [products, searchQuery]);

  const addToCart = (product: Product) => {
    setCart((prev) => {
      const existing = prev.find((item) => item.product.id === product.id);

      if (existing) {
        if (existing.quantity >= product.stock_quantity) {
          messageApi.warning("Đã đạt số lượng tồn kho tối đa");
          return prev;
        }

        return prev.map((item) =>
          item.product.id === product.id
            ? { ...item, quantity: item.quantity + 1 }
            : item,
        );
      }

      return [...prev, { product, quantity: 1 }];
    });
  };

  const updateCartQuantity = (productId: string, delta: number) => {
    setCart((prev) =>
      prev
        .map((item) => {
          if (item.product.id !== productId) return item;

          const nextQuantity = item.quantity + delta;
          if (nextQuantity <= 0) return null;

          if (nextQuantity > item.product.stock_quantity) {
            messageApi.warning("Vượt quá số lượng tồn kho");
            return item;
          }

          return { ...item, quantity: nextQuantity };
        })
        .filter((item): item is CartItem => Boolean(item)),
    );
  };

  const removeFromCart = (productId: string) => {
    setCart((prev) => prev.filter((item) => item.product.id !== productId));
  };

  const cartSummary = useMemo(() => {
    const base = cart.reduce(
      (summary, item) => {
        const effectiveDiscountPercent = getEffectiveDiscountPercent({
          discountPercent: item.product.discount_percent,
          discountStartAt: item.product.discount_start_at,
          discountEndAt: item.product.discount_end_at,
        });
        const unitPrice = calculateDiscountedPrice(
          item.product.price,
          effectiveDiscountPercent,
        );

        return {
          itemCount: summary.itemCount + item.quantity,
          subtotal: summary.subtotal + unitPrice * item.quantity,
          discountAmount:
            summary.discountAmount +
            Math.round(
              unitPrice *
                item.quantity *
                ((discountModeWatch === "order_total"
                  ? appliedDiscountPercent
                  : productDiscountPercentMap[item.product.id] || 0) /
                  100),
            ),
        };
      },
      { itemCount: 0, subtotal: 0, discountAmount: 0 },
    );

    return {
      ...base,
      finalTotal: Math.max(0, base.subtotal - base.discountAmount),
    };
  }, [
    cart,
    appliedDiscountPercent,
    discountModeWatch,
    productDiscountPercentMap,
  ]);

  const handleSubmit = async (values: QuickSalesForm) => {
    if (cart.length === 0) {
      messageApi.error("Vui lòng thêm ít nhất 1 sản phẩm");
      return;
    }

    setIsSubmitting(true);
    try {
      const manualProductDiscounts =
        discountEnabledWatch && discountModeWatch === "product_items"
          ? cart
              .map((item) => ({
                productId: item.product.id,
                percent: Math.min(
                  100,
                  Math.max(0, productDiscountPercentMap[item.product.id] || 0),
                ),
              }))
              .filter((item) => item.percent > 0)
          : [];

      const result = await createOrder({
        customer: {
          name: values.customerName.trim(),
          phone: values.customerPhone.trim(),
          address: values.customerAddress?.trim() || "Mua tại quầy",
          notes: values.notes?.trim() || undefined,
        },
        isCounterSale: true,
        checkoutMethod: "cod",
        paymentMethod: "cod",
        manualDiscountPercent:
          discountEnabledWatch && discountModeWatch === "order_total"
            ? appliedDiscountPercent
            : 0,
        manualDiscountMode: discountModeWatch,
        manualProductDiscounts,
        items: cart.map((item) => ({
          product_id: item.product.id,
          quantity: item.quantity,
        })),
      });

      if (!result.success) {
        throw new Error(result.message || "Không thể tạo đơn hàng");
      }

      messageApi.success(
        `Đã tạo đơn hàng #${result.orderId?.slice(0, 8)} cho bán tại quầy`,
      );

      form.resetFields();
      setCart([]);
      setSearchQuery("");

      const productsRes = await fetch(
        `/api/products?activeOnly=true&noCache=1&t=${Date.now()}`,
        { cache: "no-store" },
      );
      if (productsRes.ok) {
        const latestProducts = (await productsRes.json()) as Product[];
        setProducts(
          latestProducts.filter((product) => product.stock_quantity > 0),
        );
      }

      await fetchRecentOrders();
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Đã xảy ra lỗi";
      messageApi.error(errorMessage);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handlePrintRecentOrder = (order: RecentOrder) => {
    let vatPercent = 0;

    Modal.confirm({
      title: "Xuất hoá đơn",
      okText: "In hoá đơn",
      cancelText: "Hủy",
      content: (
        <div style={{ marginTop: 12 }}>
          <div style={{ marginBottom: 8, color: "#595959" }}>
            Nhập % khấu trừ VAT áp dụng cho hóa đơn này.
          </div>
          <Input
            type="number"
            min={0}
            max={100}
            defaultValue={0}
            suffix="%"
            onChange={(event) => {
              vatPercent = Number(event.target.value || 0);
            }}
          />
        </div>
      ),
      onOk: () => {
        const html = buildInvoiceHtml(
          {
            orderId: order.id,
            orderDate: new Date(order.created_at).toLocaleString("vi-VN"),
            customerName: order.customer_name,
            customerPhone: order.customer_phone,
            customerAddress: order.customer_address,
            notes: order.notes,
            totalAmount: order.total_amount,
            items: order.order_items.map((item) => ({
              name: item.products?.name || "Sản phẩm",
              quantity: item.quantity,
              unitPrice: item.unit_price,
              subtotal: item.subtotal,
            })),
          },
          { vatPercent },
        );

        const ok = printInvoiceHtml(html);
        if (!ok) {
          messageApi.error("Không thể xuất hóa đơn");
        }
      },
    });
  };

  return (
    <div style={{ background: "#f5f5f5", minHeight: "100vh", padding: 16 }}>
      {contextHolder}

      <Space orientation="vertical" size={16} style={{ width: "100%" }}>
        <Card>
          <Space orientation="vertical" size={4}>
            <Title level={3} style={{ margin: 0 }}>
              Bán hàng nhanh tại quầy
            </Title>
            <Text type="secondary">
              Nhân viên chọn sản phẩm, nhập thông tin khách và tạo đơn ngay tại
              cửa hàng.
            </Text>
          </Space>
        </Card>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "minmax(320px, 1.2fr) minmax(320px, 1fr)",
            gap: 16,
            alignItems: "start",
          }}
        >
          <Card title="Chọn sản phẩm" loading={isLoadingProducts}>
            <Input
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder="Tìm theo tên hoặc danh mục"
              prefix={<SearchOutlined />}
              style={{ marginBottom: 12 }}
            />

            <div
              style={{
                maxHeight: 420,
                overflowY: "auto",
                border: "1px solid #f0f0f0",
                borderRadius: 8,
              }}
            >
              {filteredProducts.length === 0 ? (
                <div style={{ padding: 16 }}>
                  <Text type="secondary">Không tìm thấy sản phẩm khả dụng</Text>
                </div>
              ) : (
                filteredProducts.map((product) => {
                  const effectiveDiscountPercent = getEffectiveDiscountPercent({
                    discountPercent: product.discount_percent,
                    discountStartAt: product.discount_start_at,
                    discountEndAt: product.discount_end_at,
                  });
                  const salePrice = calculateDiscountedPrice(
                    product.price,
                    effectiveDiscountPercent,
                  );

                  return (
                    <div
                      key={product.id}
                      style={{
                        padding: "10px 12px",
                        cursor: "pointer",
                        borderBottom: "1px solid #f0f0f0",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        gap: 12,
                      }}
                      onClick={() => addToCart(product)}
                    >
                      <div>
                        <Space size={8} wrap>
                          <Text strong>{product.name}</Text>
                          {effectiveDiscountPercent > 0 && (
                            <Tag color="red">-{effectiveDiscountPercent}%</Tag>
                          )}
                        </Space>
                        <Space size={8} wrap>
                          <Text type="secondary">{product.category}</Text>
                          <Text type="secondary">
                            Còn {product.stock_quantity}
                          </Text>
                        </Space>
                      </div>
                      <div style={{ textAlign: "right" }}>
                        <div style={{ color: "#cf1322", fontWeight: 600 }}>
                          {formatCurrency(salePrice)}
                        </div>
                        {effectiveDiscountPercent > 0 && (
                          <Text
                            delete
                            type="secondary"
                            style={{ fontSize: 12 }}
                          >
                            {formatCurrency(product.price)}
                          </Text>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </Card>

          <Card
            title={
              <Space>
                <ShoppingCartOutlined />
                <span>Giỏ bán nhanh</span>
                <Badge count={cartSummary.itemCount} showZero />
              </Space>
            }
          >
            {cart.length === 0 ? (
              <Text type="secondary">Chưa có sản phẩm trong giỏ.</Text>
            ) : (
              <div
                style={{ maxHeight: 240, overflowY: "auto", marginBottom: 12 }}
              >
                {cart.map((item) => {
                  const effectiveDiscountPercent = getEffectiveDiscountPercent({
                    discountPercent: item.product.discount_percent,
                    discountStartAt: item.product.discount_start_at,
                    discountEndAt: item.product.discount_end_at,
                  });
                  const unitPrice = calculateDiscountedPrice(
                    item.product.price,
                    effectiveDiscountPercent,
                  );

                  return (
                    <Card
                      key={item.product.id}
                      size="small"
                      style={{ marginBottom: 8 }}
                    >
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                          gap: 12,
                        }}
                      >
                        <div style={{ flex: 1 }}>
                          <Text strong>{item.product.name}</Text>
                          <div>
                            <Text type="secondary" style={{ fontSize: 12 }}>
                              {formatCurrency(unitPrice)} × {item.quantity}
                            </Text>
                          </div>
                        </div>

                        <Space>
                          <Button
                            icon={<MinusOutlined />}
                            size="small"
                            onClick={() =>
                              updateCartQuantity(item.product.id, -1)
                            }
                          />
                          <InputNumber
                            min={1}
                            max={item.product.stock_quantity}
                            value={item.quantity}
                            controls={false}
                            onChange={(value) => {
                              const next = Number(value || 1);
                              const delta = next - item.quantity;
                              if (delta !== 0) {
                                updateCartQuantity(item.product.id, delta);
                              }
                            }}
                            style={{ width: 60 }}
                          />
                          <Button
                            icon={<PlusOutlined />}
                            size="small"
                            onClick={() =>
                              updateCartQuantity(item.product.id, 1)
                            }
                          />
                          <Button
                            icon={<DeleteOutlined />}
                            size="small"
                            danger
                            onClick={() => removeFromCart(item.product.id)}
                          />
                        </Space>
                      </div>
                    </Card>
                  );
                })}
              </div>
            )}

            <Divider style={{ margin: "12px 0" }} />

            <Form
              form={form}
              layout="vertical"
              onFinish={handleSubmit}
              initialValues={{
                customerAddress: "Mua tại quầy",
                discountEnabled: false,
                discountPercent: 0,
                discountMode: "order_total",
                discountProductPercents: {},
              }}
            >
              <Form.Item
                name="customerName"
                label="Tên khách hàng"
                rules={[{ required: true, message: "Vui lòng nhập tên khách" }]}
              >
                <Input placeholder="Ví dụ: Khách lẻ" />
              </Form.Item>

              <Form.Item
                name="customerPhone"
                label="Số điện thoại"
                rules={[
                  { required: true, message: "Vui lòng nhập số điện thoại" },
                  {
                    pattern: /^[0-9\s()+-]{10,20}$/,
                    message: "Số điện thoại không hợp lệ",
                  },
                ]}
              >
                <Input placeholder="Nhập số điện thoại" />
              </Form.Item>

              <Form.Item name="customerAddress" label="Địa chỉ">
                <Input placeholder="Mua tại quầy" />
              </Form.Item>

              <div
                style={{
                  border: "1px solid #f0f0f0",
                  borderRadius: 8,
                  padding: 12,
                  marginBottom: 12,
                }}
              >
                <Form.Item
                  name="discountEnabled"
                  label="Áp dụng giảm giá"
                  valuePropName="checked"
                  style={{ marginBottom: discountEnabledWatch ? 12 : 0 }}
                >
                  <Switch checkedChildren="Bật" unCheckedChildren="Tắt" />
                </Form.Item>

                {discountEnabledWatch && (
                  <>
                    <Form.Item name="discountMode" label="Kiểu giảm giá">
                      <Select
                        options={[
                          {
                            label: "Giảm theo tổng order",
                            value: "order_total",
                          },
                          {
                            label: "Giảm theo từng sản phẩm trong giỏ",
                            value: "product_items",
                          },
                        ]}
                      />
                    </Form.Item>

                    {discountModeWatch === "order_total" && (
                      <Form.Item
                        name="discountPercent"
                        label="Giảm giá (%)"
                        rules={[
                          {
                            type: "number",
                            min: 0,
                            max: 100,
                            message: "Giảm giá từ 0-100%",
                          },
                        ]}
                        tooltip="Nếu nhập > 0 thì sẽ trừ trực tiếp vào tổng đơn tại quầy."
                      >
                        <InputNumber
                          min={0}
                          max={100}
                          precision={0}
                          step={1}
                          style={{ width: "100%" }}
                        />
                      </Form.Item>
                    )}

                    {discountModeWatch === "product_items" && (
                      <div style={{ display: "grid", gap: 8 }}>
                        {cart.length === 0 ? (
                          <Text type="secondary">
                            Thêm sản phẩm vào giỏ để nhập % giảm riêng.
                          </Text>
                        ) : (
                          cart.map((item) => (
                            <div
                              key={`discount-${item.product.id}`}
                              style={{
                                display: "grid",
                                gridTemplateColumns: "1fr 120px",
                                gap: 8,
                                alignItems: "center",
                              }}
                            >
                              <Text>{item.product.name}</Text>
                              <Form.Item
                                name={[
                                  "discountProductPercents",
                                  item.product.id,
                                ]}
                                style={{ marginBottom: 0 }}
                              >
                                <InputNumber
                                  min={0}
                                  max={100}
                                  precision={0}
                                  step={1}
                                  placeholder="0%"
                                  style={{ width: "100%" }}
                                  addonAfter="%"
                                />
                              </Form.Item>
                            </div>
                          ))
                        )}
                      </div>
                    )}
                  </>
                )}
              </div>

              <div
                style={{
                  border: "1px solid #f0f0f0",
                  borderRadius: 8,
                  padding: 12,
                  marginBottom: 12,
                }}
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    marginBottom: 6,
                  }}
                >
                  <Text>Tạm tính</Text>
                  <Text>{formatCurrency(cartSummary.subtotal)}</Text>
                </div>
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    marginBottom: 6,
                  }}
                >
                  <Text type="secondary">
                    Giảm giá
                    {discountModeWatch === "product_items" &&
                    discountedProductCount > 0
                      ? ` (${discountedProductCount} sản phẩm)`
                      : ""}
                  </Text>
                  <Text type="secondary">
                    -{formatCurrency(cartSummary.discountAmount)}
                    {discountModeWatch === "order_total" &&
                    appliedDiscountPercent > 0
                      ? ` (${appliedDiscountPercent}%)`
                      : ""}
                  </Text>
                </div>
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    marginTop: 8,
                  }}
                >
                  <Text strong>Tổng thanh toán</Text>
                  <Text strong style={{ color: "#cf1322", fontSize: 18 }}>
                    {formatCurrency(cartSummary.finalTotal)}
                  </Text>
                </div>
              </div>

              <Form.Item name="notes" label="Ghi chú">
                <TextArea rows={2} placeholder="Ghi chú thêm (nếu có)" />
              </Form.Item>

              <Button
                type="primary"
                htmlType="submit"
                block
                size="large"
                loading={isSubmitting}
                disabled={cart.length === 0}
              >
                Xác nhận bán nhanh
              </Button>
            </Form>
          </Card>
        </div>

        <Card
          title="5 đơn hàng gần nhất"
          extra={
            <Button
              icon={<ReloadOutlined spin={isLoadingRecentOrders} />}
              onClick={fetchRecentOrders}
              loading={isLoadingRecentOrders}
              size="small"
            >
              Làm mới
            </Button>
          }
        >
          {isLoadingRecentOrders ? (
            <div style={{ padding: 12 }}>
              <Text type="secondary">Đang tải đơn hàng gần đây...</Text>
            </div>
          ) : recentOrders.length === 0 ? (
            <div style={{ padding: 12 }}>
              <Text type="secondary">Chưa có đơn hàng gần đây</Text>
            </div>
          ) : (
            <div style={{ display: "grid", gap: 12 }}>
              {recentOrders.map((order) => (
                <Card key={order.id} size="small">
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "flex-start",
                      gap: 12,
                    }}
                  >
                    <Space orientation="vertical" size={0}>
                      <Space size={8}>
                        <Text strong>
                          #{order.id.slice(0, 8).toUpperCase()}
                        </Text>
                        <Tag color="blue">
                          {new Date(order.created_at).toLocaleTimeString(
                            "vi-VN",
                          )}
                        </Tag>
                      </Space>
                      <Text type="secondary">
                        {order.customer_name} • {order.customer_phone}
                      </Text>
                      <Text strong style={{ color: "#1677ff" }}>
                        {formatCurrency(order.total_amount)}
                      </Text>
                    </Space>

                    <Button
                      type="link"
                      icon={<PrinterOutlined />}
                      onClick={() => handlePrintRecentOrder(order)}
                    >
                      Xuất hoá đơn
                    </Button>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </Card>
      </Space>
    </div>
  );
}
