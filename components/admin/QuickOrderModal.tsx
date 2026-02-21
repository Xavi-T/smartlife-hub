"use client";

import { useState, useEffect } from "react";
import {
  Modal,
  Form,
  Input,
  Button,
  List,
  Card,
  InputNumber,
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
      const res = await fetch("/api/products");
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

  const handleSubmit = async (values: any) => {
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
        },
        items: cart.map((item) => ({
          productId: item.product.id,
          quantity: item.quantity,
        })),
        notes: values.notes || undefined,
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
              <List
                dataSource={filteredProducts}
                renderItem={(product) => (
                  <List.Item
                    style={{ cursor: "pointer", padding: "8px 12px" }}
                    onClick={() => addToCart(product)}
                  >
                    <List.Item.Meta
                      title={<Text strong>{product.name}</Text>}
                      description={
                        <Text type="secondary">
                          {formatCurrency(product.price)} • Còn{" "}
                          {product.stock_quantity}
                        </Text>
                      }
                    />
                    <PlusOutlined style={{ color: "#1890ff" }} />
                  </List.Item>
                )}
              />
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

export function QuickOrderModal({ isOpen, onClose }: QuickOrderModalProps) {
  const [products, setProducts] = useState<Product[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [customerAddress, setCustomerAddress] = useState("");
  const [notes, setNotes] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (isOpen) {
      fetchProducts();
    }
  }, [isOpen]);

  const fetchProducts = async () => {
    try {
      const res = await fetch("/api/products");
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
        toast.warning("Đã đạt số lượng tồn kho tối đa");
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
              toast.warning("Vượt quá số lượng tồn kho");
              return item;
            }
            return { ...item, quantity: newQuantity };
          }
          return item;
        })
        .filter((item): item is CartItem => item !== null),
    );
  };

  const totalAmount = cart.reduce(
    (sum, item) => sum + item.product.price * item.quantity,
    0,
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (cart.length === 0) {
      toast.error("Vui lòng thêm sản phẩm vào đơn hàng");
      return;
    }

    setIsSubmitting(true);

    try {
      const result = await createOrder({
        customer: {
          name: customerName,
          phone: customerPhone,
          address: customerAddress,
        },
        items: cart.map((item) => ({
          productId: item.product.id,
          quantity: item.quantity,
        })),
        notes: notes || undefined,
      });

      if (result.success) {
        toast.success(
          `Đơn hàng #${result.orderId?.slice(0, 8)} đã được tạo thành công!`,
        );
        // Reset form
        setCart([]);
        setCustomerName("");
        setCustomerPhone("");
        setCustomerAddress("");
        setNotes("");
        onClose();
      } else {
        toast.error(result.message || "Không thể tạo đơn hàng");
      }
    } catch (error) {
      console.error("Error creating order:", error);
      toast.error("Đã xảy ra lỗi khi tạo đơn hàng");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-50 rounded-lg">
              <ShoppingCart className="w-6 h-6 text-blue-600" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-gray-900">
                Tạo đơn hàng nhanh
              </h2>
              <p className="text-sm text-gray-500">
                Thêm sản phẩm và thông tin khách hàng
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        {/* Content */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-auto">
          <div className="p-6 grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Left: Product Selection */}
            <div>
              <h3 className="font-semibold text-gray-900 mb-3">
                Chọn sản phẩm
              </h3>

              {/* Search */}
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Tìm sản phẩm..."
                className="w-full px-4 py-2 border-2 border-gray-400 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 mb-3 text-gray-900 placeholder:text-gray-600 font-medium"
              />

              {/* Product List */}
              <div className="space-y-2 max-h-64 overflow-y-auto border border-gray-200 rounded-lg p-2">
                {filteredProducts.map((product) => (
                  <button
                    key={product.id}
                    type="button"
                    onClick={() => addToCart(product)}
                    className="w-full flex items-center justify-between p-3 hover:bg-gray-50 rounded-lg transition-colors text-left"
                  >
                    <div className="flex-1">
                      <p className="font-medium text-sm text-gray-900">
                        {product.name}
                      </p>
                      <p className="text-xs text-gray-500">
                        {formatCurrency(product.price)} • Còn{" "}
                        {product.stock_quantity}
                      </p>
                    </div>
                    <Plus className="w-5 h-5 text-blue-600" />
                  </button>
                ))}
              </div>

              {/* Cart */}
              <div className="mt-4">
                <h4 className="font-semibold text-gray-900 mb-2">
                  Giỏ hàng ({cart.length})
                </h4>
                {cart.length === 0 ? (
                  <p className="text-sm text-gray-500 text-center py-4">
                    Chưa có sản phẩm
                  </p>
                ) : (
                  <div className="space-y-2">
                    {cart.map((item) => (
                      <div
                        key={item.product.id}
                        className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg"
                      >
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-sm text-gray-900 truncate">
                            {item.product.name}
                          </p>
                          <p className="text-xs text-gray-500">
                            {formatCurrency(item.product.price)} ×{" "}
                            {item.quantity}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => updateQuantity(item.product.id, -1)}
                            className="p-1 hover:bg-gray-200 rounded"
                          >
                            <Minus className="w-4 h-4" />
                          </button>
                          <span className="w-8 text-center font-medium text-sm">
                            {item.quantity}
                          </span>
                          <button
                            type="button"
                            onClick={() => updateQuantity(item.product.id, 1)}
                            className="p-1 hover:bg-gray-200 rounded"
                          >
                            <Plus className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Right: Customer Info */}
            <div>
              <h3 className="font-semibold text-gray-900 mb-3">
                Thông tin khách hàng
              </h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Họ tên <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                    required
                    className="w-full px-4 py-2 border-2 border-gray-400 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900 placeholder:text-gray-600 font-medium"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Số điện thoại <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="tel"
                    value={customerPhone}
                    onChange={(e) => setCustomerPhone(e.target.value)}
                    required
                    className="w-full px-4 py-2 border-2 border-gray-400 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900 placeholder:text-gray-600 font-medium"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Địa chỉ <span className="text-red-500">*</span>
                  </label>
                  <textarea
                    value={customerAddress}
                    onChange={(e) => setCustomerAddress(e.target.value)}
                    required
                    rows={3}
                    className="w-full px-4 py-2 border-2 border-gray-400 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900 placeholder:text-gray-600 font-medium"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Ghi chú
                  </label>
                  <textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    rows={2}
                    className="w-full px-4 py-2 border-2 border-gray-400 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900 placeholder:text-gray-600 font-medium"
                  />
                </div>

                {/* Total */}
                <div className="pt-4 border-t border-gray-200">
                  <div className="flex items-center justify-between mb-4">
                    <span className="text-lg font-semibold text-gray-900">
                      Tổng cộng:
                    </span>
                    <span className="text-2xl font-bold text-blue-600">
                      {formatCurrency(totalAmount)}
                    </span>
                  </div>

                  <button
                    type="submit"
                    disabled={isSubmitting || cart.length === 0}
                    className="w-full py-3 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-lg hover:from-blue-700 hover:to-blue-800 transition-all font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  >
                    {isSubmitting ? (
                      <>
                        <Loader2 className="w-5 h-5 animate-spin" />
                        Đang xử lý...
                      </>
                    ) : (
                      <>
                        <ShoppingCart className="w-5 h-5" />
                        Tạo đơn hàng
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
