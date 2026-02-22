"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Alert,
  Button,
  Card,
  Empty,
  Input,
  Space,
  Spin,
  Steps,
  Tag,
  Typography,
  message,
} from "antd";
import { Header } from "@/components/home/Header";
import { getOrdersByPhone } from "@/actions/orders";
import { formatCurrency } from "@/lib/utils";

type OrderStatus = "pending" | "processing" | "delivered" | "cancelled";

interface OrderItemView {
  id: string;
  quantity: number;
  unit_price: number;
  subtotal: number;
  products: {
    name: string;
    image_url: string | null;
  } | null;
}

interface OrderView {
  id: string;
  customer_name: string;
  customer_phone: string;
  customer_address: string;
  total_amount: number;
  status: OrderStatus;
  checkout_method?: "cod" | "bank_transfer";
  payment_method?: "cod" | "bank_transfer";
  payment_confirmed?: boolean;
  payment_confirmed_at?: string | null;
  notes: string | null;
  created_at: string;
  order_items: OrderItemView[];
}

function getStatusMeta(status: OrderStatus) {
  if (status === "pending") return { label: "Chờ xử lý", color: "gold" };
  if (status === "processing") return { label: "Đang xử lý", color: "blue" };
  if (status === "delivered") return { label: "Đã giao", color: "green" };
  return { label: "Đã hủy", color: "red" };
}

function getTimelineCurrent(status: OrderStatus): number {
  if (status === "pending") return 0;
  if (status === "processing") return 2;
  if (status === "delivered") return 3;
  return 1;
}

function getDeliveryStepItems(status: OrderStatus) {
  const baseItems = [
    { title: "Chờ xác nhận", content: "Đơn hàng đã được tiếp nhận" },
    { title: "Đã xác nhận", content: "Cửa hàng xác nhận và chuẩn bị" },
    { title: "Đang giao", content: "Đơn vị vận chuyển đang giao" },
    { title: "Đã giao", content: "Khách đã nhận hàng" },
  ];

  if (status !== "cancelled") return baseItems;

  return [
    { title: "Chờ xác nhận", content: "Đơn hàng đã được tiếp nhận" },
    { title: "Đã hủy", content: "Đơn hàng đã bị hủy" },
  ];
}

function getPaymentMeta(order: OrderView): {
  label: string;
  color: "default" | "processing" | "success" | "warning";
  detail?: string;
} {
  if (order.payment_method === "bank_transfer") {
    if (order.payment_confirmed) {
      return {
        label: "Đã xác nhận thanh toán chuyển khoản",
        color: "success",
        detail: order.payment_confirmed_at
          ? `Xác nhận lúc ${new Date(order.payment_confirmed_at).toLocaleString("vi-VN")}`
          : undefined,
      };
    }

    return {
      label: "Đang chờ xác nhận thanh toán chuyển khoản",
      color: "processing",
      detail: "Hệ thống sẽ xác nhận sau khi cửa hàng kiểm tra giao dịch.",
    };
  }

  return {
    label: "Thanh toán khi nhận hàng (COD)",
    color: "default",
  };
}

export default function OrderTrackingPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [messageApi, contextHolder] = message.useMessage();
  const [phone, setPhone] = useState(searchParams.get("phone") || "");
  const [isLoading, setIsLoading] = useState(false);
  const [orders, setOrders] = useState<OrderView[]>([]);
  const [searched, setSearched] = useState(false);

  const hasCreatedFlag = searchParams.get("created") === "1";

  useEffect(() => {
    if (hasCreatedFlag) {
      messageApi.success("Đơn hàng đã được tạo. Bạn có thể theo dõi bên dưới.");
    }
  }, [hasCreatedFlag, messageApi]);

  useEffect(() => {
    const initialPhone = searchParams.get("phone");
    if (initialPhone) {
      handleSearch(initialPhone);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const normalizedPhone = useMemo(() => phone.replace(/\D/g, ""), [phone]);

  const handleSearch = async (phoneValue?: string) => {
    const targetPhone = (phoneValue || phone).replace(/\D/g, "");
    if (targetPhone.length < 10) {
      messageApi.error("Vui lòng nhập số điện thoại hợp lệ");
      return;
    }

    setIsLoading(true);
    setSearched(true);

    try {
      const result = await getOrdersByPhone(targetPhone);
      if (!result.success) {
        messageApi.error(result.message || "Không thể tra cứu đơn hàng");
        setOrders([]);
        return;
      }
      setOrders((result.data || []) as OrderView[]);
    } catch (error) {
      console.error("Order tracking error:", error);
      messageApi.error("Không thể tra cứu đơn hàng");
      setOrders([]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {contextHolder}
      <Header cartItemsCount={0} onCartClick={() => router.push("/")} />

      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Typography.Title level={2} style={{ marginBottom: 8 }}>
          Kiểm tra đơn hàng
        </Typography.Title>
        <Typography.Text type="secondary">
          Nhập số điện thoại đã đặt hàng để xem danh sách và trạng thái đơn.
        </Typography.Text>

        <Card style={{ marginTop: 20, marginBottom: 20 }}>
          <Space.Compact style={{ width: "100%" }}>
            <Input
              value={phone}
              onChange={(event) => setPhone(event.target.value)}
              placeholder="Nhập số điện thoại, ví dụ 0901234567"
              onPressEnter={() => handleSearch()}
            />
            <Button
              type="primary"
              onClick={() => handleSearch()}
              loading={isLoading}
            >
              Tra cứu
            </Button>
          </Space.Compact>
          {normalizedPhone.length > 0 && normalizedPhone.length < 10 && (
            <Typography.Text
              type="danger"
              style={{ display: "block", marginTop: 8 }}
            >
              Số điện thoại cần ít nhất 10 số.
            </Typography.Text>
          )}
        </Card>

        {isLoading ? (
          <div style={{ textAlign: "center", padding: 40 }}>
            <Spin />
          </div>
        ) : orders.length === 0 ? (
          searched ? (
            <Empty description="Không tìm thấy đơn hàng với số điện thoại này" />
          ) : (
            <Alert
              type="info"
              showIcon
              title="Bạn chưa tra cứu"
              description="Hãy nhập số điện thoại để xem lịch sử đơn hàng của bạn."
            />
          )
        ) : (
          <Space orientation="vertical" size={16} style={{ width: "100%" }}>
            {orders.map((order) => {
              const statusMeta = getStatusMeta(order.status);
              const paymentMeta = getPaymentMeta(order);
              return (
                <Card key={order.id}>
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      marginBottom: 8,
                      gap: 8,
                      flexWrap: "wrap",
                    }}
                  >
                    <Typography.Text strong>
                      Mã đơn: #{order.id.slice(0, 8).toUpperCase()}
                    </Typography.Text>
                    <Tag color={statusMeta.color}>{statusMeta.label}</Tag>
                  </div>

                  <Typography.Text
                    type="secondary"
                    style={{ display: "block" }}
                  >
                    Ngày đặt:{" "}
                    {new Date(order.created_at).toLocaleString("vi-VN")}
                  </Typography.Text>
                  <Typography.Text style={{ display: "block" }}>
                    Người nhận: {order.customer_name} - {order.customer_phone}
                  </Typography.Text>
                  <Typography.Text
                    style={{ display: "block", marginBottom: 10 }}
                  >
                    Địa chỉ: {order.customer_address}
                  </Typography.Text>

                  <div style={{ marginBottom: 12 }}>
                    <Typography.Text type="secondary">
                      Thanh toán:
                    </Typography.Text>
                    <div style={{ marginTop: 4 }}>
                      <Tag color={paymentMeta.color}>{paymentMeta.label}</Tag>
                    </div>
                    {paymentMeta.detail && (
                      <Typography.Text
                        type="secondary"
                        style={{ display: "block", marginTop: 4 }}
                      >
                        {paymentMeta.detail}
                      </Typography.Text>
                    )}
                  </div>

                  <div style={{ marginBottom: 14 }}>
                    <Steps
                      size="small"
                      current={getTimelineCurrent(order.status)}
                      status={
                        order.status === "cancelled" ? "error" : "process"
                      }
                      items={getDeliveryStepItems(order.status)}
                    />
                  </div>

                  {order.status === "cancelled" && (
                    <Alert
                      type="error"
                      showIcon
                      style={{ marginBottom: 12 }}
                      title="Đơn hàng đã bị hủy"
                      description="Vui lòng liên hệ cửa hàng để biết thêm chi tiết hoặc đặt lại đơn mới."
                    />
                  )}

                  <Space
                    orientation="vertical"
                    size={8}
                    style={{ width: "100%" }}
                  >
                    {order.order_items?.map((item) => (
                      <div
                        key={item.id}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                          borderBottom: "1px solid #f5f5f5",
                          paddingBottom: 8,
                        }}
                      >
                        <Typography.Text>
                          {item.products?.name || "Sản phẩm"} × {item.quantity}
                        </Typography.Text>
                        <Typography.Text>
                          {formatCurrency(item.subtotal)}
                        </Typography.Text>
                      </div>
                    ))}
                  </Space>

                  <div
                    style={{
                      marginTop: 12,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                    }}
                  >
                    <Typography.Text strong>Tổng thanh toán</Typography.Text>
                    <Typography.Text strong style={{ color: "#1677ff" }}>
                      {formatCurrency(order.total_amount)}
                    </Typography.Text>
                  </div>

                  {order.notes && (
                    <Alert
                      type="warning"
                      showIcon
                      style={{ marginTop: 12 }}
                      title="Ghi chú đơn hàng"
                      description={order.notes}
                    />
                  )}
                </Card>
              );
            })}
          </Space>
        )}
      </div>
    </div>
  );
}
