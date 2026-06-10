"use client";
import { Card, Col, Row, Space, Typography } from "antd";
import {
  CheckCircleOutlined,
  HeartOutlined,
  ShopOutlined,
} from "@ant-design/icons";
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
    <div className="sl-public-shell">
      <Header
        cartItemsCount={getTotalItems()}
        onCartClick={() => router.push("/")}
      />

      <main className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-4 sm:py-8 pb-36 md:pb-8">
        <Card className="sl-animate-in" styles={{ body: { padding: 20 } }}>
          <div className="mb-6 max-w-3xl">
            <div className="sl-brand-pill mb-3 px-3 py-2 text-sm font-semibold">
              <HeartOutlined />
              SmartLife Hub
            </div>
            <Typography.Title
              level={1}
              className="sl-section-title !mb-3 !text-[30px] sm:!text-[40px]"
            >
              Về chúng tôi
            </Typography.Title>
            <Typography.Paragraph className="!mb-0 !text-base sm:!text-lg">
              {APP_CONFIG.shopName} xây dựng không gian tư vấn và mua sắm sản
              phẩm chăm sóc sức khỏe theo hướng gần gũi, rõ ràng và phù hợp nhu
              cầu từng gia đình.
            </Typography.Paragraph>
          </div>

          <Row gutter={[16, 16]}>
            <Col xs={24} lg={12}>
              <Card
                size="small"
                title={
                  <Space>
                    <ShopOutlined />
                    <span>Thông tin doanh nghiệp</span>
                  </Space>
                }
              >
                <Space orientation="vertical" size={8}>
                  <Typography.Text strong className="!text-base sm:!text-lg">
                    {APP_CONFIG.shopName}
                  </Typography.Text>
                  <Typography.Text>{APP_CONFIG.shopAddress}</Typography.Text>
                  <Typography.Text>Hotline: {APP_CONFIG.shopPhone}</Typography.Text>
                  <Typography.Text>Email: {APP_CONFIG.shopEmail}</Typography.Text>
                  <Typography.Text>Mã số thuế: {APP_CONFIG.taxCode}</Typography.Text>
                  <Typography.Text>
                    Website:{" "}
                    <a
                      href={APP_CONFIG.shopWebsite}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{ color: "var(--sl-blue-dark)" }}
                    >
                      {APP_CONFIG.shopWebsite}
                    </a>
                  </Typography.Text>
                </Space>
              </Card>
            </Col>

            <Col xs={24} lg={12}>
              <Card
                size="small"
                title={
                  <Space>
                    <CheckCircleOutlined />
                    <span>Cam kết dịch vụ</span>
                  </Space>
                }
              >
                <Space orientation="vertical" size={10}>
                  {coreValues.map((value) => (
                    <Space key={value} align="start">
                      <CheckCircleOutlined style={{ color: "var(--sl-green)" }} />
                      <Typography.Text>{value}</Typography.Text>
                    </Space>
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
