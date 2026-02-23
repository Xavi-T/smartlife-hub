"use client";

import { useEffect, useState } from "react";
import {
  Card,
  Table,
  Button,
  Space,
  Tag,
  Statistic,
  Row,
  Col,
  DatePicker,
  Select,
} from "antd";
import type { ColumnsType } from "antd/es/table";
import {
  PlusOutlined,
  ReloadOutlined,
  InboxOutlined,
  CalendarOutlined,
  FilterOutlined,
} from "@ant-design/icons";
import { StockInboundModal } from "@/components/admin/StockInboundModal";
import { formatCurrency } from "@/lib/utils";
import dayjs from "dayjs";

const { RangePicker } = DatePicker;

interface StockInboundRecord {
  id: string;
  product_id: string;
  product_name: string;
  quantity_added: number;
  cost_price_at_time: number;
  supplier: string | null;
  notes: string | null;
  created_at: string;
  old_stock_quantity?: number | null;
  new_stock_quantity?: number | null;
  old_weighted_avg_cost?: number | null;
  new_weighted_avg_cost?: number | null;
  new_cost_price?: number | null;
  products?: {
    name?: string;
    cost_price?: number;
  } | null;
}

interface StockInboundStats {
  totalRecords: number;
  totalQuantity: number;
  totalValue: number;
  todayRecords: number;
}

export default function StockInboundPage() {
  const [records, setRecords] = useState<StockInboundRecord[]>([]);
  const [stats, setStats] = useState<StockInboundStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<string | null>(null);

  const normalizeNumber = (value: unknown): number | null => {
    const n = Number(value);
    return Number.isFinite(n) ? n : null;
  };

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const recordsRes = await fetch("/api/admin/stock-inbound");

      if (!recordsRes.ok) {
        setRecords([]);
        setStats(null);
        return;
      }

      const payload = await recordsRes.json();
      const inbounds = Array.isArray(payload?.inbounds) ? payload.inbounds : [];

      const normalizedRecords: StockInboundRecord[] = inbounds.map(
        (item: any) => ({
          ...item,
          quantity_added: Number(item.quantity_added) || 0,
          cost_price_at_time: Number(item.cost_price_at_time) || 0,
          old_stock_quantity: normalizeNumber(item.old_stock_quantity),
          new_stock_quantity: normalizeNumber(item.new_stock_quantity),
          old_weighted_avg_cost: normalizeNumber(item.old_weighted_avg_cost),
          new_weighted_avg_cost: normalizeNumber(item.new_weighted_avg_cost),
          new_cost_price: normalizeNumber(item.new_cost_price),
          product_name: item.product_name || item.products?.name || "N/A",
        }),
      );

      setRecords(normalizedRecords);
      setStats(
        payload?.stats
          ? {
              totalRecords: payload.stats.totalRecords || 0,
              totalQuantity: payload.stats.totalQuantity || 0,
              totalValue: payload.stats.totalValue || 0,
              todayRecords: payload.stats.todayRecords || 0,
            }
          : null,
      );
    } catch (error) {
      console.error("Error fetching data:", error);
      setRecords([]);
      setStats(null);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleModalSuccess = () => {
    fetchData();
  };

  const columns: ColumnsType<StockInboundRecord> = [
    {
      title: "Thời gian",
      dataIndex: "created_at",
      key: "created_at",
      width: 160,
      render: (date: string) => (
        <div>
          <div>{dayjs(date).format("DD/MM/YYYY")}</div>
          <div style={{ fontSize: 12, color: "#8c8c8c" }}>
            {dayjs(date).format("HH:mm")}
          </div>
        </div>
      ),
      sorter: (a, b) => dayjs(a.created_at).unix() - dayjs(b.created_at).unix(),
      defaultSortOrder: "descend",
    },
    {
      title: "Sản phẩm",
      dataIndex: "product_name",
      key: "product_name",
      render: (name: string) => <div style={{ fontWeight: 500 }}>{name}</div>,
    },
    {
      title: "Số lượng",
      key: "quantity",
      width: 200,
      render: (_: any, record: StockInboundRecord) => (
        <div>
          <div>
            <Tag color="blue" style={{ fontSize: 13, fontWeight: 600 }}>
              +{record.quantity_added}
            </Tag>
          </div>
          {record.old_stock_quantity != null &&
            record.new_stock_quantity != null && (
              <div style={{ fontSize: 12, color: "#8c8c8c", marginTop: 4 }}>
                {record.old_stock_quantity} → {record.new_stock_quantity}
              </div>
            )}
        </div>
      ),
    },
    {
      title: "Giá vốn",
      key: "cost",
      width: 180,
      render: (_: any, record: StockInboundRecord) => (
        <div>
          <div style={{ fontWeight: 500 }}>
            {formatCurrency(record.cost_price_at_time)}/sp
          </div>
          <div style={{ fontSize: 12, color: "#8c8c8c", marginTop: 4 }}>
            Tổng:{" "}
            {formatCurrency(record.quantity_added * record.cost_price_at_time)}
          </div>
        </div>
      ),
    },
    {
      title: "Giá vốn sau nhập",
      dataIndex: "new_weighted_avg_cost",
      key: "new_weighted_avg_cost",
      width: 140,
      render: (cost: number, record: StockInboundRecord) =>
        (() => {
          const resolvedCost =
            normalizeNumber(cost) ??
            normalizeNumber(record.new_cost_price) ??
            normalizeNumber(record.products?.cost_price) ??
            normalizeNumber(record.cost_price_at_time);
          const oldCost = normalizeNumber(record.old_weighted_avg_cost);
          const hasValidCost = resolvedCost !== null;
          const hasChange =
            hasValidCost && oldCost !== null && oldCost !== resolvedCost;

          return (
            <div>
              <div style={{ fontWeight: 500 }}>
                {hasValidCost ? formatCurrency(resolvedCost) : "Chưa có"}
              </div>
              {hasChange && (
                <div style={{ fontSize: 11, color: "#52c41a" }}>
                  {oldCost! > resolvedCost! ? "↓" : "↑"}{" "}
                  {formatCurrency(Math.abs(resolvedCost! - oldCost!))}
                </div>
              )}
            </div>
          );
        })(),
    },
    {
      title: "Nhà cung cấp",
      dataIndex: "supplier",
      key: "supplier",
      width: 150,
      render: (supplier: string | null) => (
        <div style={{ color: supplier ? "#262626" : "#8c8c8c" }}>
          {supplier || "Chưa ghi"}
        </div>
      ),
    },
    {
      title: "Ghi chú",
      dataIndex: "notes",
      key: "notes",
      ellipsis: true,
      render: (notes: string | null) => (
        <div
          style={{
            color: notes ? "#595959" : "#bfbfbf",
            fontStyle: notes ? "normal" : "italic",
          }}
        >
          {notes || "Không có"}
        </div>
      ),
    },
  ];

  return (
    <div style={{ padding: 24, background: "#f5f5f5", minHeight: "100vh" }}>
      {/* Header */}
      <div
        style={{
          marginBottom: 24,
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <div>
          <h1 style={{ margin: 0, fontSize: 24, fontWeight: 600 }}>
            <InboxOutlined style={{ marginRight: 8 }} />
            Lịch sử nhập kho
          </h1>
          <p style={{ margin: "4px 0 0 0", color: "#8c8c8c" }}>
            Quản lý và theo dõi các lần nhập hàng vào kho
          </p>
        </div>
        <Space>
          <Button
            icon={<ReloadOutlined />}
            onClick={fetchData}
            loading={isLoading}
          >
            Làm mới
          </Button>
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={() => setIsModalOpen(true)}
            size="large"
          >
            Nhập hàng mới
          </Button>
        </Space>
      </div>

      {/* Statistics Cards */}
      {stats && (
        <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
          <Col xs={24} sm={12} lg={6}>
            <Card>
              <Statistic
                title="Tổng lượt nhập"
                value={stats.totalRecords}
                prefix={<InboxOutlined style={{ color: "#1890ff" }} />}
                styles={{ content: { color: "#1890ff" } }}
              />
            </Card>
          </Col>
          <Col xs={24} sm={12} lg={6}>
            <Card>
              <Statistic
                title="Tổng số lượng"
                value={stats.totalQuantity}
                prefix={<InboxOutlined style={{ color: "#52c41a" }} />}
                styles={{ content: { color: "#52c41a" } }}
                suffix="sản phẩm"
              />
            </Card>
          </Col>
          <Col xs={24} sm={12} lg={6}>
            <Card>
              <Statistic
                title="Tổng giá trị nhập"
                value={stats.totalValue}
                prefix={<InboxOutlined style={{ color: "#722ed1" }} />}
                styles={{ content: { color: "#722ed1" } }}
                formatter={(value) => formatCurrency(value as number)}
              />
            </Card>
          </Col>
          <Col xs={24} sm={12} lg={6}>
            <Card>
              <Statistic
                title="Nhập hôm nay"
                value={stats.todayRecords}
                prefix={<CalendarOutlined style={{ color: "#faad14" }} />}
                styles={{ content: { color: "#faad14" } }}
                suffix="lượt"
              />
            </Card>
          </Col>
        </Row>
      )}

      {/* Table */}
      <Card>
        <Table
          columns={columns}
          dataSource={records}
          loading={isLoading}
          rowKey="id"
          pagination={{
            pageSize: 20,
            showSizeChanger: true,
            showTotal: (total) => `Tổng ${total} bản ghi`,
          }}
          scroll={{ x: 1200 }}
        />
      </Card>

      {/* Modal */}
      <StockInboundModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSuccess={handleModalSuccess}
      />
    </div>
  );
}
