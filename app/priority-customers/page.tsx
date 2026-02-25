"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Card, Input, List, Space, Tag, Typography } from "antd";
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
  const { cart, isLoaded } = useCart();
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
    <div className="min-h-screen bg-gray-50">
      <Header
        cartItemsCount={isLoaded ? cart.length : 0}
        onCartClick={() => router.push("/")}
      />

      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Space orientation="vertical" size={16} style={{ width: "100%" }}>
          <div>
            <Typography.Title level={2} style={{ marginBottom: 4 }}>
              Danh sách khách hàng ưu tiên
            </Typography.Title>
            <Typography.Text type="secondary">
              Danh sách công khai khách hàng ưu tiên của {APP_CONFIG.shopName}{" "}
              (SĐT đã được ẩn).
            </Typography.Text>
          </div>

          <Card>
            <Input
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder="Tìm theo tên khách hàng"
              allowClear
            />
          </Card>

          <Card>
            <List
              loading={isLoading}
              dataSource={filteredCustomers}
              locale={{ emptyText: "Chưa có khách hàng ưu tiên" }}
              renderItem={(customer) => (
                <List.Item>
                  <Space
                    orientation="vertical"
                    size={2}
                    style={{ width: "100%" }}
                  >
                    <Space>
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
                </List.Item>
              )}
            />
          </Card>

          <div>
            <Button onClick={() => router.push("/")}>Quay về trang chủ</Button>
          </div>
        </Space>
      </div>
    </div>
  );
}
