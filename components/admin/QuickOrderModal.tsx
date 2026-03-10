"use client";

import { useState, useEffect } from "react";
import {
  Modal,
  Form,
  Input,
  Button,
  Card,
  Space,
  Typography,
  Divider,
  Badge,
  message,
} from "antd";
import {
  ShoppingCartOutlined,
  PlusOutlined,
  MinusOutlined,
  DeleteOutlined,
  SearchOutlined,
} from "@ant-design/icons";
import { createOrder } from "@/actions/orders";
import { formatCurrency } from "@/lib/utils";

const { TextArea } = Input;
const { Text, Title } = Typography;

interface Product {
  id: string;
  name: string;
  price: number;
  stock_quantity: number;
  category: string;
}

interface CartItem {
  product: Product;
  quantity: number;
}

interface QuickOrderModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface QuickOrderFormValues {
  customerName: string;
  customerPhone: string;
  customerAddress: string;
  notes?: string;
}

export function QuickOrderModal({ isOpen, onClose }: QuickOrderModalProps) {
  const [form] = Form.useForm();
  const [messageApi, contextHolder] = message.useMessage();
  const [products, setProducts] = useState<Product[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (isOpen) {
      fetchProducts();
    }
  }, [isOpen]);

  const fetchProducts = async () => {
    try {
      const res = await fetch(`/api/products?noCache=1&t=${Date.now()}`, {
        cache: "no-store",
      });
      if (res.ok) {
        const data = await res.json();
        setProducts(data.filter((p: Product) => p.stock_quantity > 0));
      }
    } catch (error) {
      console.error("Error fetching products:", error);
    }
  };

  const filteredProducts = products.filter((p) =>
    p.name.toLowerCase().includes(searchQuery.toLowerCase()),
  );

  const addToCart = (product: Product) => {
    const existing = cart.find((item) => item.product.id === product.id);
    if (existing) {
      if (existing.quantity < product.stock_quantity) {
        setCart(
          cart.map((item) =>
            item.product.id === product.id
              ? { ...item, quantity: item.quantity + 1 }
              : item,
          ),
        );
      } else {
        messageApi.warning("Đã đạt số lượng tồn kho tối đa");
      }
    } else {
      setCart([...cart, { product, quantity: 1 }]);
    }
  };

  const updateQuantity = (productId: string, delta: number) => {
    setCart(
      cart
        .map((item) => {
          if (item.product.id === productId) {
            const newQuantity = item.quantity + delta;
            if (newQuantity <= 0) return null;
            if (newQuantity > item.product.stock_quantity) {
              messageApi.warning("Vượt quá số lượng tồn kho");
              return item;
            }
            return { ...item, quantity: newQuantity };
          }
          return item;
        })
        .filter((item): item is CartItem => item !== null),
    );
  };

  const removeFromCart = (productId: string) => {
    setCart(cart.filter((item) => item.product.id !== productId));
  };

  const totalAmount = cart.reduce(
    (sum, item) => sum + item.product.price * item.quantity,
    0,
  );

  const handleSubmit = async (values: QuickOrderFormValues) => {
    if (cart.length === 0) {
      messageApi.error("Vui lòng thêm sản phẩm vào đơn hàng");
      return;
    }

    setIsSubmitting(true);

    try {
      const result = await createOrder({
        customer: {
          name: values.customerName,
          phone: values.customerPhone,
          address: values.customerAddress,
          notes: values.notes || undefined,
        },
        items: cart.map((item) => ({
          product_id: item.product.id,
          quantity: item.quantity,
        })),
      });

      if (result.success) {
        messageApi.success(
          `Đơn hàng #${result.orderId?.slice(0, 8)} đã được tạo thành công!`,
        );
        // Reset form
        form.resetFields();
        setCart([]);
        onClose();
      } else {
        messageApi.error(result.message || "Không thể tạo đơn hàng");
      }
    } catch (error) {
      console.error("Error creating order:", error);
      messageApi.error("Đã xảy ra lỗi khi tạo đơn hàng");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    if (!isSubmitting) {
      form.resetFields();
      setCart([]);
      setSearchQuery("");
      onClose();
    }
  };

  return (
    <>
      {contextHolder}
      <Modal
        title={
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <ShoppingCartOutlined style={{ fontSize: 20 }} />
            <div>
              <div>Tạo đơn hàng nhanh</div>
              <div
                style={{ fontSize: 12, fontWeight: "normal", color: "#8c8c8c" }}
              >
                Thêm sản phẩm và thông tin khách hàng
              </div>
            </div>
          </div>
        }
        open={isOpen}
        onCancel={handleClose}
        width={900}
        footer={null}
        destroyOnHidden
      >
        <div
          style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24 }}
        >
          {/* Left: Product Selection */}
          <div>
            <Title level={5}>Chọn sản phẩm</Title>

            <Input
              prefix={<SearchOutlined />}
              placeholder="Tìm sản phẩm..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{ marginBottom: 16 }}
            />

            <div
              style={{
                maxHeight: 250,
                overflowY: "auto",
                border: "1px solid #d9d9d9",
                borderRadius: 8,
                padding: 8,
              }}
            >
              {filteredProducts.length === 0 ? (
                <Text type="secondary">Không có sản phẩm phù hợp</Text>
              ) : (
                <div style={{ display: "grid", gap: 6 }}>
                  {filteredProducts.map((product) => (
                    <div
                      key={product.id}
                      style={{
                        cursor: "pointer",
                        padding: "8px 12px",
                        border: "1px solid #f0f0f0",
                        borderRadius: 8,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        gap: 12,
                      }}
                      onClick={() => addToCart(product)}
                    >
                      <div style={{ minWidth: 0 }}>
                        <Text strong>{product.name}</Text>
                        <div>
                          <Text type="secondary">
                            {formatCurrency(product.price)} • Còn{" "}
                            {product.stock_quantity}
                          </Text>
                        </div>
                      </div>
                      <PlusOutlined style={{ color: "#1890ff" }} />
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Cart */}
            <Divider />
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                marginBottom: 12,
              }}
            >
              <Title level={5} style={{ margin: 0 }}>
                Giỏ hàng
              </Title>
              <Badge count={cart.length} showZero />
            </div>

            {cart.length === 0 ? (
              <Text
                type="secondary"
                style={{ display: "block", textAlign: "center", padding: 16 }}
              >
                Chưa có sản phẩm
              </Text>
            ) : (
              <div style={{ maxHeight: 200, overflowY: "auto" }}>
                {cart.map((item) => (
                  <Card
                    key={item.product.id}
                    size="small"
                    style={{ marginBottom: 8 }}
                  >
                    <div
                      style={{ display: "flex", alignItems: "center", gap: 12 }}
                    >
                      <div style={{ flex: 1 }}>
                        <Text strong style={{ fontSize: 14 }}>
                          {item.product.name}
                        </Text>
                        <div>
                          <Text type="secondary" style={{ fontSize: 12 }}>
                            {formatCurrency(item.product.price)} ×{" "}
                            {item.quantity}
                          </Text>
                        </div>
                      </div>
                      <Space>
                        <Button
                          size="small"
                          icon={<MinusOutlined />}
                          onClick={() => updateQuantity(item.product.id, -1)}
                        />
                        <Text
                          strong
                          style={{
                            minWidth: 24,
                            textAlign: "center",
                            display: "inline-block",
                          }}
                        >
                          {item.quantity}
                        </Text>
                        <Button
                          size="small"
                          icon={<PlusOutlined />}
                          onClick={() => updateQuantity(item.product.id, 1)}
                        />
                        <Button
                          size="small"
                          danger
                          icon={<DeleteOutlined />}
                          onClick={() => removeFromCart(item.product.id)}
                        />
                      </Space>
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </div>

          {/* Right: Customer Info */}
          <div>
            <Title level={5}>Thông tin khách hàng</Title>

            <Form form={form} layout="vertical" onFinish={handleSubmit}>
              <Form.Item
                name="customerName"
                label="Họ tên"
                rules={[{ required: true, message: "Vui lòng nhập họ tên" }]}
              >
                <Input placeholder="Nhập họ tên khách hàng" />
              </Form.Item>

              <Form.Item
                name="customerPhone"
                label="Số điện thoại"
                rules={[
                  { required: true, message: "Vui lòng nhập số điện thoại" },
                  {
                    pattern: /^[0-9]{10,11}$/,
                    message: "Số điện thoại không hợp lệ",
                  },
                ]}
              >
                <Input placeholder="Nhập số điện thoại" />
              </Form.Item>

              <Form.Item
                name="customerAddress"
                label="Địa chỉ"
                rules={[{ required: true, message: "Vui lòng nhập địa chỉ" }]}
              >
                <TextArea rows={3} placeholder="Nhập địa chỉ giao hàng" />
              </Form.Item>

              <Form.Item name="notes" label="Ghi chú">
                <TextArea
                  rows={2}
                  placeholder="Ghi chú thêm (không bắt buộc)"
                />
              </Form.Item>

              <Divider />

              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  marginBottom: 16,
                }}
              >
                <Text strong style={{ fontSize: 18 }}>
                  Tổng cộng:
                </Text>
                <Text strong style={{ fontSize: 24, color: "#1890ff" }}>
                  {formatCurrency(totalAmount)}
                </Text>
              </div>

              <Form.Item style={{ marginBottom: 0 }}>
                <Button
                  type="primary"
                  htmlType="submit"
                  icon={<ShoppingCartOutlined />}
                  loading={isSubmitting}
                  disabled={cart.length === 0}
                  block
                  size="large"
                >
                  Tạo đơn hàng
                </Button>
              </Form.Item>
            </Form>
          </div>
        </div>
      </Modal>
    </>
  );
}
