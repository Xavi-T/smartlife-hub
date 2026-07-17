"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Alert,
  Button,
  Card,
  Collapse,
  Empty,
  Input,
  Space,
  Spin,
  Steps,
  Tag,
  Timeline,
  Typography,
  message,
} from "antd";
import { Header } from "@/components/home/Header";
import { getOrdersByPhone } from "@/actions/orders";
import { formatCurrency } from "@/lib/utils";
import { APP_CONFIG } from "@/lib/appConfig";

type OrderStatus =
  | "pending"
  | "confirmed"
  | "shipping"
  | "completed"
  | "cancelled";

interface OrderStatusHistory {
  id: string;
  status: OrderStatus;
  note: string | null;
  created_at: string;
}

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
  order_type?: "online" | "counter";
  checkout_method?: "cod" | "bank_transfer";
  payment_method?: "cod" | "bank_transfer" | "cash";
  payment_confirmed?: boolean;
  payment_confirmed_at?: string | null;
  notes: string | null;
  created_at: string;
  order_items: OrderItemView[];
  order_status_history?: OrderStatusHistory[];
}

function getStatusMeta(status: OrderStatus) {
  if (status === "pending") return { label: "Chờ xác nhận", color: "gold" };
  if (status === "confirmed") return { label: "Đã xác nhận", color: "blue" };
  if (status === "shipping") return { label: "Đang vận chuyển", color: "cyan" };
  if (status === "completed") return { label: "Đã hoàn thành", color: "green" };
  return { label: "Đã hủy", color: "red" };
}

function getTimelineCurrent(order: OrderView): number {
  const status = order.status;
  if (status === "pending") return 0;
  if (status === "confirmed") return 1;
  if (status === "shipping") return 2;
  if (status === "completed") return order.order_type === "counter" ? 0 : 3;

  const completedStatuses = new Set(
    (order.order_status_history || []).map((history) => history.status),
  );
  if (completedStatuses.has("completed")) return 3;
  if (completedStatuses.has("shipping")) return 2;
  if (completedStatuses.has("confirmed")) return 1;
  return 0;
}

function getHistoryNote(
  order: OrderView,
  status: OrderStatus,
  fallback: string,
) {
  const history = [...(order.order_status_history || [])]
    .filter((item) => item.status === status)
    .sort(
      (first, second) =>
        new Date(second.created_at).getTime() -
        new Date(first.created_at).getTime(),
    )[0];
  return history?.note || fallback;
}

function getDeliveryStepItems(order: OrderView) {
  if (order.order_type === "counter") {
    return [
      {
        title: "Đã hoàn thành",
        content: getHistoryNote(
          order,
          "completed",
          "Đơn mua tại quầy đã hoàn thành.",
        ),
      },
    ];
  }

  return [
    {
      title: "Chờ xác nhận",
      content: getHistoryNote(order, "pending", "Đơn hàng đã được tiếp nhận."),
    },
    {
      title: "Đã xác nhận",
      content: getHistoryNote(
        order,
        "confirmed",
        "Cửa hàng xác nhận và chuẩn bị hàng.",
      ),
    },
    {
      title: "Đang vận chuyển",
      content: getHistoryNote(
        order,
        "shipping",
        "Đơn vị vận chuyển đang giao hàng.",
      ),
    },
    {
      title: "Đã hoàn thành",
      content: getHistoryNote(order, "completed", "Khách hàng đã nhận hàng."),
    },
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

  if (order.payment_method === "cash") {
    return {
      label: "Đã thanh toán tiền mặt",
      color: "success",
    };
  }

  return {
    label: "Thanh toán khi nhận hàng (COD)",
    color: "default",
  };
}

function OrderTrackingContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [messageApi, contextHolder] = message.useMessage();
  const [phone, setPhone] = useState(searchParams.get("phone") || "");
  const [isLoading, setIsLoading] = useState(false);
  const [orders, setOrders] = useState<OrderView[]>([]);
  const [searched, setSearched] = useState(false);
  const [activeOrderKeys, setActiveOrderKeys] = useState<string[]>([]);

  const examplePhone = useMemo(
    () => APP_CONFIG.shopPhone.replace(/\D/g, "") || "0901234567",
    [],
  );

  const hasCreatedFlag = searchParams.get("created") === "1";

  useEffect(() => {
    if (!hasCreatedFlag) return;

    const queryKey =
      typeof window !== "undefined" ? window.location.search : "";
    const toastKey = `order-track-created-toast:${queryKey}`;
    if (typeof window !== "undefined") {
      const alreadyShown = window.sessionStorage.getItem(toastKey);
      if (alreadyShown === "1") return;
      window.sessionStorage.setItem(toastKey, "1");
    }

    messageApi.success("Đơn hàng đã được tạo. Bạn có thể theo dõi bên dưới.");
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
        setActiveOrderKeys([]);
        return;
      }
      const nextOrders = ((result.data || []) as OrderView[]).sort(
        (first, second) =>
          new Date(second.created_at).getTime() -
          new Date(first.created_at).getTime(),
      );
      setOrders(nextOrders);
      setActiveOrderKeys(nextOrders[0] ? [nextOrders[0].id] : []);
    } catch (error) {
      console.error("Order tracking error:", error);
      messageApi.error("Không thể tra cứu đơn hàng");
      setOrders([]);
      setActiveOrderKeys([]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="sl-public-shell">
      {contextHolder}
      <Header cartItemsCount={0} onCartClick={() => router.push("/")} />

      <div className="max-w-5xl mx-auto px-3 sm:px-6 lg:px-8 py-4 sm:py-8 pb-36 md:pb-8">
        <Typography.Title
          level={1}
          className="sl-section-title !mb-2 !text-[30px] sm:!text-[40px]"
        >
          Kiểm tra đơn hàng
        </Typography.Title>
        <Typography.Text type="secondary">
          Nhập số điện thoại đã đặt hàng để xem danh sách và trạng thái đơn.
        </Typography.Text>

        <Card
          style={{ marginTop: 20, marginBottom: 20 }}
          styles={{ body: { padding: 16 } }}
        >
          <Space.Compact style={{ width: "100%" }}>
            <Input
              value={phone}
              onChange={(event) => setPhone(event.target.value)}
              placeholder={`Nhập số điện thoại, ví dụ ${examplePhone}`}
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
          <Collapse
            activeKey={activeOrderKeys}
            onChange={(keys) =>
              setActiveOrderKeys(
                Array.isArray(keys) ? keys.map((item) => String(item)) : [],
              )
            }
            items={orders.map((order) => {
              const statusMeta = getStatusMeta(order.status);
              const paymentMeta = getPaymentMeta(order);
              return {
                key: order.id,
                label: (
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      gap: 8,
                      flexWrap: "wrap",
                    }}
                  >
                    <div>
                      <Typography.Text strong style={{ fontSize: 14 }}>
                        #{order.id.slice(0, 8).toUpperCase()}
                      </Typography.Text>
                      <Typography.Text
                        type="secondary"
                        style={{ display: "block", fontSize: 12 }}
                      >
                        {new Date(order.created_at).toLocaleString("vi-VN")}
                      </Typography.Text>
                    </div>
                    <Tag color={statusMeta.color}>{statusMeta.label}</Tag>
                  </div>
                ),
                children: (
                  <div>
                    <Typography.Text style={{ display: "block", fontSize: 14 }}>
                      Người nhận: {order.customer_name} - {order.customer_phone}
                    </Typography.Text>
                    <Typography.Text
                      style={{
                        display: "block",
                        marginBottom: 10,
                        fontSize: 14,
                      }}
                    >
                      Địa chỉ: {order.customer_address}
                    </Typography.Text>

                    <div style={{ marginBottom: 12 }}>
                      <Typography.Text
                        type="secondary"
                        style={{ fontSize: 13 }}
                      >
                        Thanh toán:
                      </Typography.Text>
                      <div style={{ marginTop: 4 }}>
                        <Tag color={paymentMeta.color}>{paymentMeta.label}</Tag>
                      </div>
                      {paymentMeta.detail && (
                        <Typography.Text
                          type="secondary"
                          style={{
                            display: "block",
                            marginTop: 4,
                            fontSize: 12,
                          }}
                        >
                          {paymentMeta.detail}
                        </Typography.Text>
                      )}
                    </div>

                    <div style={{ marginBottom: 14 }}>
                      <Steps
                        size="small"
                        current={getTimelineCurrent(order)}
                        status={
                          order.status === "cancelled" ? "error" : "process"
                        }
                        items={getDeliveryStepItems(order)}
                      />
                    </div>

                    {order.status === "cancelled" && (
                      <Alert
                        type="error"
                        showIcon
                        style={{ marginBottom: 12 }}
                        title="Đơn hàng đã bị hủy"
                        description={getHistoryNote(
                          order,
                          "cancelled",
                          "Vui lòng liên hệ cửa hàng để biết thêm chi tiết.",
                        )}
                      />
                    )}

                    {order.order_status_history &&
                      order.order_status_history.length > 0 && (
                        <Card
                          size="small"
                          title="Cập nhật đơn hàng"
                          style={{ marginBottom: 12 }}
                        >
                          <Timeline
                            items={[...order.order_status_history]
                              .sort(
                                (first, second) =>
                                  new Date(second.created_at).getTime() -
                                  new Date(first.created_at).getTime(),
                              )
                              .map((history) => ({
                                color:
                                  history.status === "cancelled"
                                    ? "red"
                                    : history.status === "completed"
                                      ? "green"
                                      : "blue",
                                children: (
                                  <div>
                                    <Typography.Text strong>
                                      {getStatusMeta(history.status).label}
                                    </Typography.Text>
                                    <Typography.Text
                                      type="secondary"
                                      style={{
                                        display: "block",
                                        fontSize: 12,
                                      }}
                                    >
                                      {new Date(
                                        history.created_at,
                                      ).toLocaleString("vi-VN")}
                                    </Typography.Text>
                                    {history.note && (
                                      <Typography.Paragraph
                                        style={{ marginBottom: 0 }}
                                      >
                                        {history.note}
                                      </Typography.Paragraph>
                                    )}
                                  </div>
                                ),
                              }))}
                          />
                        </Card>
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
                            gap: 8,
                          }}
                        >
                          <Typography.Text style={{ fontSize: 14 }}>
                            {item.products?.name || "Sản phẩm"} ×{" "}
                            {item.quantity}
                          </Typography.Text>
                          <Typography.Text style={{ fontSize: 14 }}>
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
                      <Typography.Text strong style={{ fontSize: 15 }}>
                        Tổng thanh toán
                      </Typography.Text>
                      <Typography.Text
                        strong
                        style={{ color: "#1677ff", fontSize: 16 }}
                      >
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
                  </div>
                ),
              };
            })}
          />
        )}
      </div>
    </div>
  );
}

export default function OrderTrackingPage() {
  return (
    <Suspense
      fallback={
        <div className="sl-public-shell flex items-center justify-center">
          <Spin size="large" />
        </div>
      }
    >
      <OrderTrackingContent />
    </Suspense>
  );
}
