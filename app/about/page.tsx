"use client";

import Link from "next/link";
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
          <Typography.Title level={2} style={{ marginTop: 0 }}>
            Về chúng tôi
          </Typography.Title>
          <Typography.Paragraph>
            {APP_CONFIG.shopName} là cửa hàng đồ gia dụng thông minh, tập trung
            vào các sản phẩm giúp tối ưu thời gian, không gian sống và trải nghiệm
            sử dụng hằng ngày.
          </Typography.Paragraph>

          <Row gutter={[16, 16]}>
            <Col xs={24} lg={12}>
              <Card size="small" title="Thông tin doanh nghiệp">
                <Space orientation="vertical" size={6}>
                  <Typography.Text strong>{APP_CONFIG.shopName}</Typography.Text>
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
                    <Typography.Text key={value}>- {value}</Typography.Text>
                  ))}
                </Space>
              </Card>
            </Col>
          </Row>

          <Card
            size="small"
            title="Kết nối với SmartLife Hub"
            style={{ marginTop: 16 }}
          >
            <Space orientation="vertical" size={6}>
              <a
                href={APP_CONFIG.socials.zalo}
                target="_blank"
                rel="noopener noreferrer"
              >
                Zalo
              </a>
              <a
                href={APP_CONFIG.socials.facebook}
                target="_blank"
                rel="noopener noreferrer"
              >
                Facebook
              </a>
              <a
                href={APP_CONFIG.socials.youtube}
                target="_blank"
                rel="noopener noreferrer"
              >
                YouTube
              </a>
              <a
                href={APP_CONFIG.socials.tiktok}
                target="_blank"
                rel="noopener noreferrer"
              >
                TikTok
              </a>
              <a
                href={APP_CONFIG.socials.instagram}
                target="_blank"
                rel="noopener noreferrer"
              >
                Instagram
              </a>
            </Space>
          </Card>

          <div style={{ marginTop: 16 }}>
            <Link href="/">Quay về trang chủ</Link>
          </div>
        </Card>
      </main>
    </div>
  );
}
