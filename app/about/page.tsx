"use client";
import { Card, Col, Row, Space, Typography } from "antd";
import { useRouter } from "next/navigation";
import { Header } from "@/components/home/Header";
import { useCart } from "@/hooks/useCart";
import { APP_CONFIG } from "@/lib/appConfig";

const coreValues = [
  "Sản phẩm chính hãng, nguồn gốc rõ ràng",
  "Tư vấn đúng nhu cầu, không bán quá mức cần thiết",
  "Hỗ trợ nhanh qua hotline, Zalo, Messenger",
  "Theo dõi đơn hàng minh bạch, dễ tra cứu",
];

export default function AboutPage() {
  const router = useRouter();
  const { getTotalItems } = useCart();

  return (
    <div className="min-h-screen bg-gray-50">
      <Header
        cartItemsCount={getTotalItems()}
        onCartClick={() => router.push("/")}
      />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Card>
          <Typography.Title
            level={2}
            style={{ marginTop: 0, fontSize: "clamp(24px, 4vw, 34px)" }}
          >
            Về chúng tôi
          </Typography.Title>
          <Typography.Paragraph style={{ fontSize: "clamp(14px, 2.2vw, 17px)" }}>
            Triết lý của {APP_CONFIG.shopName}: {APP_CONFIG.shopTagline}.
          </Typography.Paragraph>

          <Row gutter={[16, 16]}>
            <Col xs={24} lg={12}>
              <Card size="small" title="Thông tin doanh nghiệp">
                <Space orientation="vertical" size={6}>
                  <Typography.Text strong style={{ fontSize: "clamp(15px, 2.1vw, 18px)" }}>
                    {APP_CONFIG.shopName}
                  </Typography.Text>
                  <Typography.Text style={{ fontSize: "clamp(14px, 2vw, 16px)" }}>
                    {APP_CONFIG.shopAddress}
                  </Typography.Text>
                  <Typography.Text style={{ fontSize: "clamp(14px, 2vw, 16px)" }}>
                    Hotline: {APP_CONFIG.shopPhone}
                  </Typography.Text>
                  <Typography.Text style={{ fontSize: "clamp(14px, 2vw, 16px)" }}>
                    Email: {APP_CONFIG.shopEmail}
                  </Typography.Text>
                  <Typography.Text style={{ fontSize: "clamp(14px, 2vw, 16px)" }}>
                    Mã số thuế: {APP_CONFIG.taxCode}
                  </Typography.Text>
                  <Typography.Text style={{ fontSize: "clamp(14px, 2vw, 16px)" }}>
                    Website:{" "}
                    <a
                      href={APP_CONFIG.shopWebsite}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{
                        color: "#111111",
                        textDecoration: "none",
                        fontSize: "clamp(14px, 2vw, 16px)",
                      }}
                    >
                      {APP_CONFIG.shopWebsite}
                    </a>
                  </Typography.Text>
                </Space>
              </Card>
            </Col>

            <Col xs={24} lg={12}>
              <Card size="small" title="Cam kết dịch vụ">
                <Space orientation="vertical" size={8}>
                  {coreValues.map((value) => (
                    <Typography.Text
                      key={value}
                      style={{ fontSize: "clamp(14px, 2vw, 16px)" }}
                    >
                      - {value}
                    </Typography.Text>
                  ))}
                </Space>
              </Card>
            </Col>
          </Row>

        </Card>
      </main>
    </div>
  );
}
