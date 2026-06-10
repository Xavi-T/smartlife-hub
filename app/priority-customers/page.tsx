"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Card, Empty, Input, Space, Spin, Tag, Typography } from "antd";
import { SearchOutlined, StarOutlined } from "@ant-design/icons";
import { Header } from "@/components/home/Header";
import { useCart } from "@/hooks/useCart";
import { APP_CONFIG } from "@/lib/appConfig";

type PublicPriorityCustomer = {
  id: string;
  customer_name: string;
  customer_phone_masked: string;
  customer_segment: string;
  discount_percent: number;
};

export default function PriorityCustomersPublicPage() {
  const router = useRouter();
  const { getTotalItems, isLoaded } = useCart();
  const [searchQuery, setSearchQuery] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [customers, setCustomers] = useState<PublicPriorityCustomer[]>([]);

  useEffect(() => {
    const fetchPriorityCustomers = async () => {
      try {
        setIsLoading(true);
        const response = await fetch("/api/priority-customers");
        if (!response.ok) return;
        const result = await response.json();
        setCustomers(Array.isArray(result.customers) ? result.customers : []);
      } catch (error) {
        console.error("Error fetching priority customers:", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchPriorityCustomers();
  }, []);

  const filteredCustomers = useMemo(() => {
    if (!searchQuery.trim()) return customers;
    const query = searchQuery.trim().toLowerCase();
    return customers.filter((customer) =>
      customer.customer_name.toLowerCase().includes(query),
    );
  }, [customers, searchQuery]);

  return (
    <div className="sl-public-shell">
      <Header
        cartItemsCount={isLoaded ? getTotalItems() : 0}
        onCartClick={() => router.push("/")}
      />

      <div className="max-w-4xl mx-auto px-3 sm:px-6 lg:px-8 py-4 sm:py-8 pb-36 md:pb-8">
        <Space orientation="vertical" size={16} style={{ width: "100%" }}>
          <div className="sl-animate-in">
            <div className="sl-brand-pill mb-3 px-3 py-2 text-sm font-semibold">
              <StarOutlined />
              Khách hàng ưu tiên
            </div>
            <Typography.Title
              level={1}
              className="sl-section-title !mb-2 !text-[30px] sm:!text-[40px]"
            >
              Danh sách khách hàng ưu tiên
            </Typography.Title>
            <Typography.Text type="secondary">
              Danh sách công khai khách hàng ưu tiên của {APP_CONFIG.shopName}{" "}
              (SĐT đã được ẩn).
            </Typography.Text>
          </div>

          <Card
            className="sl-animate-in sl-animate-delay-1"
            styles={{ body: { padding: 16 } }}
          >
            <Input
              prefix={<SearchOutlined />}
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder="Tìm theo tên khách hàng"
              allowClear
            />
          </Card>

          <Card
            className="sl-animate-in sl-animate-delay-2"
            styles={{ body: { padding: 16 } }}
          >
            {isLoading ? (
              <div className="py-8 text-center">
                <Spin />
                <Typography.Text
                  type="secondary"
                  style={{ display: "block", marginTop: 10 }}
                >
                  Đang tải danh sách...
                </Typography.Text>
              </div>
            ) : filteredCustomers.length === 0 ? (
              <Empty description="Chưa có khách hàng ưu tiên" />
            ) : (
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {filteredCustomers.map((customer) => (
                  <div
                    key={customer.id}
                    className="rounded-lg border border-gray-200 bg-white p-3"
                  >
                    <Space orientation="vertical" size={6} style={{ width: "100%" }}>
                      <Space wrap>
                        <Typography.Text strong>
                          {customer.customer_name}
                        </Typography.Text>
                        <Tag color="gold">{customer.customer_segment}</Tag>
                        <Tag color="blue">
                          -{Number(customer.discount_percent || 0)}%
                        </Tag>
                      </Space>
                      <Typography.Text type="secondary">
                        {customer.customer_phone_masked}
                      </Typography.Text>
                    </Space>
                  </div>
                ))}
              </div>
            )}
          </Card>

          <div>
            <Button type="primary" onClick={() => router.push("/")}>
              Quay về trang chủ
            </Button>
          </div>
        </Space>
      </div>
    </div>
  );
}
