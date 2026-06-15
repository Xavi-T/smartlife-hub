"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Alert,
  Button,
  Card,
  Grid,
  Input,
  InputNumber,
  Popconfirm,
  Progress,
  Select,
  Space,
  Statistic,
  Switch,
  Table,
  Tag,
  Typography,
  message,
} from "antd";
import type { ColumnsType } from "antd/es/table";
import {
  CopyOutlined,
  DeleteOutlined,
  DownloadOutlined,
  PlusOutlined,
} from "@ant-design/icons";
import {
  calculateClinicalNutritionLine,
  calculateClinicalNutritionPlan,
  findClinicalNutritionProduct,
  formatClinicalNutritionNumber,
  type ClinicalNutritionLineInput,
  type ClinicalNutritionLineResult,
  type ClinicalNutritionProduct,
  type ClinicalNutritionUnit,
} from "@/lib/clinicalNutrition";

function createLineId() {
  return `clinical-line-${Date.now()}-${Math.random()
    .toString(36)
    .slice(2, 8)}`;
}

function escapeCsvCell(value: string | number) {
  const text = String(value);
  if (!/[",\n]/.test(text)) return text;
  return `"${text.replace(/"/g, '""')}"`;
}

function buildExportRows(lines: ClinicalNutritionLineResult[]) {
  return lines
    .filter((line) => line.product)
    .map((line) => ({
      quantity: formatClinicalNutritionNumber(line.quantity, 2),
      productName: line.product?.name || "",
      unit: line.unit,
      amount: formatClinicalNutritionNumber(line.amount, 2),
      totalAmount: formatClinicalNutritionNumber(line.totalAmount, 2),
      proteinG: formatClinicalNutritionNumber(line.proteinG, 2),
      lipidG: formatClinicalNutritionNumber(line.lipidG, 2),
      glucoseG: formatClinicalNutritionNumber(line.glucoseG, 2),
      energyKcal: formatClinicalNutritionNumber(line.energyKcal, 2),
      note: line.note || "",
    }));
}

interface ClinicalNutritionCatalogProduct extends ClinicalNutritionProduct {
  isActive: boolean;
  sortOrder: number;
  createdAt?: string;
  updatedAt?: string;
}

interface ClinicalProductFormState {
  id?: string;
  name: string;
  unit: ClinicalNutritionUnit;
  proteinPer100: number;
  lipidPer100: number;
  glucosePer100: number;
  energyPer100: number;
  note: string;
  isActive: boolean;
  sortOrder: number;
}

const EMPTY_PRODUCT_FORM: ClinicalProductFormState = {
  name: "",
  unit: "ml",
  proteinPer100: 0,
  lipidPer100: 0,
  glucosePer100: 0,
  energyPer100: 0,
  note: "",
  isActive: true,
  sortOrder: 0,
};

function safeDivide(value: number, denominator: number) {
  return denominator > 0 ? value / denominator : 0;
}

function getTargetStatus(actual: number, target: number) {
  if (target <= 0) return { color: "default", label: "Chưa đặt" };
  const percent = (actual / target) * 100;
  if (percent < 90) return { color: "gold", label: "Thiếu" };
  if (percent <= 110) return { color: "green", label: "Đạt" };
  return { color: "red", label: "Vượt" };
}

function getProgressColor(actual: number, target: number) {
  const status = getTargetStatus(actual, target);
  if (status.color === "green") return "#389e0d";
  if (status.color === "red") return "#cf1322";
  if (status.color === "gold") return "#d48806";
  return "#1677ff";
}

function TargetProgress(props: {
  title: string;
  actual: number;
  target: number;
  suffix: string;
  precision?: number;
}) {
  const { title, actual, target, suffix, precision = 1 } = props;
  const percent = target > 0 ? (actual / target) * 100 : 0;
  const status = getTargetStatus(actual, target);

  return (
    <div className="rounded-md border border-gray-200 bg-white p-3">
      <div className="mb-2 flex items-center justify-between gap-2">
        <Typography.Text strong>{title}</Typography.Text>
        <Tag color={status.color}>{status.label}</Tag>
      </div>
      <Progress
        percent={Math.min(140, Math.round(percent))}
        showInfo={false}
        strokeColor={getProgressColor(actual, target)}
      />
      <div className="mt-2 flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
        <Typography.Text>
          {formatClinicalNutritionNumber(actual, precision)} {suffix}
        </Typography.Text>
        <Typography.Text type="secondary">
          Mục tiêu {formatClinicalNutritionNumber(target, precision)} {suffix}
        </Typography.Text>
      </div>
    </div>
  );
}

function MobileMetric(props: {
  label: string;
  value: string;
  unit?: string;
  color?: string;
}) {
  const { label, value, unit, color } = props;

  return (
    <div className="rounded-md bg-gray-50 p-2">
      <Typography.Text type="secondary" style={{ fontSize: 11 }}>
        {label}
      </Typography.Text>
      <div
        className="mt-1 text-[15px] font-semibold leading-tight"
        style={{ color }}
      >
        {value}
        {unit ? <span className="ml-1 text-xs font-medium">{unit}</span> : null}
      </div>
    </div>
  );
}

function MobileCalculationLineCard(props: {
  record: ClinicalNutritionLineResult;
  productOptions: Array<{ label: string; value: string }>;
  clinicalProducts: ClinicalNutritionCatalogProduct[];
  updateLine: (
    lineId: string,
    patch: Partial<ClinicalNutritionLineInput>,
  ) => void;
  removeLine: (lineId: string) => void;
}) {
  const {
    record,
    productOptions,
    clinicalProducts,
    updateLine,
    removeLine,
  } = props;

  return (
    <div className="rounded-md border border-gray-200 bg-white p-3 shadow-sm">
      <div className="mb-3 flex items-start justify-between gap-2">
        <div className="min-w-0">
          <Typography.Text strong className="block truncate">
            {record.product?.name || "Chưa chọn sản phẩm"}
          </Typography.Text>
          <div className="mt-1 flex flex-wrap items-center gap-1">
            <Tag style={{ margin: 0 }}>{record.unit || "-"}</Tag>
            <Typography.Text type="secondary" style={{ fontSize: 12 }}>
              {formatClinicalNutritionNumber(record.totalAmount, 2)}{" "}
              {record.unit || "đơn vị"}
            </Typography.Text>
          </div>
        </div>
        <Button
          size="small"
          danger
          icon={<DeleteOutlined />}
          onClick={() => removeLine(record.id)}
          aria-label="Xóa dòng"
        />
      </div>

      <Select
        size="large"
        showSearch
        allowClear
        placeholder="Chọn sản phẩm"
        options={productOptions}
        value={record.productId || undefined}
        onChange={(productId?: string) => {
          const product = productId
            ? findClinicalNutritionProduct(productId, clinicalProducts)
            : null;
          updateLine(record.id, {
            productId: productId || "",
            amount: record.amount || (product ? 100 : 0),
            note: record.note || product?.note || "",
          });
        }}
        filterOption={(input, option) =>
          String(option?.label || "")
            .toLowerCase()
            .includes(input.toLowerCase())
        }
        style={{ width: "100%" }}
      />

      <div className="mt-3 grid grid-cols-2 gap-2">
        <div>
          <Typography.Text strong style={{ fontSize: 12 }}>
            Số lượng
          </Typography.Text>
          <InputNumber
            size="large"
            min={0}
            step={0.25}
            precision={2}
            value={record.quantity}
            onChange={(value) =>
              updateLine(record.id, { quantity: Number(value ?? 0) })
            }
            style={{ marginTop: 6, width: "100%" }}
          />
        </div>
        <div>
          <Typography.Text strong style={{ fontSize: 12 }}>
            Hàm lượng
          </Typography.Text>
          <Space.Compact style={{ marginTop: 6, width: "100%" }}>
            <InputNumber
              size="large"
              min={0}
              step={record.unit === "g" ? 1 : 10}
              precision={2}
              value={record.amount}
              onChange={(value) =>
                updateLine(record.id, { amount: Number(value ?? 0) })
              }
              style={{ flex: 1, width: "100%" }}
            />
            <Input
              size="large"
              value={record.unit || "-"}
              readOnly
              style={{ width: 48, textAlign: "center" }}
            />
          </Space.Compact>
        </div>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2">
        <MobileMetric
          label="Protein"
          value={formatClinicalNutritionNumber(record.proteinG, 2)}
          unit="g"
          color="#389e0d"
        />
        <MobileMetric
          label="Lipid"
          value={formatClinicalNutritionNumber(record.lipidG, 2)}
          unit="g"
          color="#d48806"
        />
        <MobileMetric
          label="Glucose"
          value={formatClinicalNutritionNumber(record.glucoseG, 2)}
          unit="g"
          color="#1677ff"
        />
        <MobileMetric
          label="Năng lượng"
          value={formatClinicalNutritionNumber(record.energyKcal, 2)}
          unit="kcal"
          color="#0958d9"
        />
      </div>

      <div className="mt-3">
        <Typography.Text strong style={{ fontSize: 12 }}>
          Chú ý
        </Typography.Text>
        <Input
          size="large"
          value={record.note || ""}
          onChange={(event) =>
            updateLine(record.id, { note: event.target.value })
          }
          style={{ marginTop: 6 }}
        />
      </div>
    </div>
  );
}

function MobileCatalogProductCard(props: {
  product: ClinicalNutritionCatalogProduct;
  addLine: (productId?: string) => void;
  editClinicalProduct: (product: ClinicalNutritionCatalogProduct) => void;
  deleteClinicalProduct: (productId: string) => void;
}) {
  const { product, addLine, editClinicalProduct, deleteClinicalProduct } =
    props;

  return (
    <div className="rounded-md border border-gray-200 bg-white p-3 shadow-sm">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <Typography.Text strong className="block">
            {product.name}
          </Typography.Text>
          <div className="mt-1 flex flex-wrap items-center gap-1">
            <Tag style={{ margin: 0 }}>{product.unit}</Tag>
            <Tag
              color={product.isActive ? "green" : "default"}
              style={{ margin: 0 }}
            >
              {product.isActive ? "Đang dùng" : "Ẩn"}
            </Tag>
          </div>
        </div>
        <Button
          size="small"
          type="primary"
          icon={<PlusOutlined />}
          disabled={!product.isActive}
          onClick={() => addLine(product.id)}
          aria-label={`Thêm ${product.name}`}
        />
      </div>

      <div className="mt-3 grid grid-cols-4 gap-2">
        <MobileMetric
          label="P/100"
          value={formatClinicalNutritionNumber(product.proteinPer100, 2)}
        />
        <MobileMetric
          label="L/100"
          value={formatClinicalNutritionNumber(product.lipidPer100, 2)}
        />
        <MobileMetric
          label="G/100"
          value={formatClinicalNutritionNumber(product.glucosePer100, 2)}
        />
        <MobileMetric
          label="E/100"
          value={formatClinicalNutritionNumber(product.energyPer100, 2)}
        />
      </div>

      {product.note ? (
        <Typography.Paragraph
          type="secondary"
          style={{ marginBottom: 0, marginTop: 10, fontSize: 12 }}
        >
          {product.note}
        </Typography.Paragraph>
      ) : null}

      <div className="mt-3 grid grid-cols-3 gap-2">
        <Button
          size="middle"
          type="primary"
          icon={<PlusOutlined />}
          disabled={!product.isActive}
          onClick={() => addLine(product.id)}
        >
          Thêm
        </Button>
        <Button size="middle" onClick={() => editClinicalProduct(product)}>
          Sửa
        </Button>
        <Popconfirm
          title="Xóa sản phẩm này?"
          okText="Xóa"
          cancelText="Hủy"
          onConfirm={() => deleteClinicalProduct(product.id)}
        >
          <Button size="middle" danger>
            Xóa
          </Button>
        </Popconfirm>
      </div>
    </div>
  );
}

export default function ClinicalNutritionCalculatorPage() {
  const screens = Grid.useBreakpoint();
  const [hasMounted, setHasMounted] = useState(false);
  const isMobile = hasMounted ? !screens.md : false;
  const controlSize = isMobile ? "large" : "middle";
  const cardStyles = { body: { padding: isMobile ? 12 : 16 } };
  const [messageApi, contextHolder] = message.useMessage();
  const [lines, setLines] = useState<ClinicalNutritionLineInput[]>([]);
  const [clinicalProducts, setClinicalProducts] = useState<
    ClinicalNutritionCatalogProduct[]
  >([]);
  const [isLoadingProducts, setIsLoadingProducts] = useState(true);
  const [isSavingProduct, setIsSavingProduct] = useState(false);
  const [catalogSearch, setCatalogSearch] = useState("");
  const [productForm, setProductForm] =
    useState<ClinicalProductFormState>(EMPTY_PRODUCT_FORM);
  const [newLineProductId, setNewLineProductId] = useState("");
  const [newLineQuantity, setNewLineQuantity] = useState(1);
  const [newLineAmount, setNewLineAmount] = useState(100);
  const [newLineNote, setNewLineNote] = useState("");
  const [patientWeightKg, setPatientWeightKg] = useState(60);
  const [administrationHours, setAdministrationHours] = useState(24);
  const [targetEnergyKcalPerKg, setTargetEnergyKcalPerKg] = useState(25);
  const [targetProteinGPerKg, setTargetProteinGPerKg] = useState(1.2);
  const [targetFluidMlPerKg, setTargetFluidMlPerKg] = useState(30);

  useEffect(() => {
    setHasMounted(true);
  }, []);

  const loadClinicalProducts = async () => {
    setIsLoadingProducts(true);
    try {
      const response = await fetch("/api/admin/nutrition/clinical-products", {
        cache: "no-store",
      });
      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.error || "Không thể tải danh mục sản phẩm");
      }
      setClinicalProducts(
        Array.isArray(result.products) ? result.products : [],
      );
    } catch (error: unknown) {
      messageApi.error(
        error instanceof Error
          ? error.message
          : "Không thể tải danh mục sản phẩm",
      );
      setClinicalProducts([]);
    } finally {
      setIsLoadingProducts(false);
    }
  };

  useEffect(() => {
    void loadClinicalProducts();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const productOptions = useMemo(
    () =>
      clinicalProducts
        .filter((product) => product.isActive)
        .map((product) => ({
          label: product.name,
          value: product.id,
        })),
    [clinicalProducts],
  );

  const calculation = useMemo(
    () => calculateClinicalNutritionPlan(lines, clinicalProducts),
    [clinicalProducts, lines],
  );
  const selectedNewLineProduct = useMemo(
    () =>
      newLineProductId
        ? findClinicalNutritionProduct(newLineProductId, clinicalProducts)
        : null,
    [clinicalProducts, newLineProductId],
  );
  const newLinePreview = useMemo(() => {
    if (!selectedNewLineProduct) return null;
    return calculateClinicalNutritionLine({
      id: "new-line-preview",
      productId: selectedNewLineProduct.id,
      quantity: Number(newLineQuantity || 0),
      amount: Number(newLineAmount || 0),
      note: newLineNote,
    }, clinicalProducts);
  }, [
    clinicalProducts,
    newLineAmount,
    newLineNote,
    newLineQuantity,
    selectedNewLineProduct,
  ]);
  const clinicalSummary = useMemo(() => {
    const weightKg = Math.max(0, Number(patientWeightKg || 0));
    const hours = Math.max(0, Number(administrationHours || 0));
    const targetEnergyKcal = weightKg * Math.max(0, targetEnergyKcalPerKg);
    const targetProteinG = weightKg * Math.max(0, targetProteinGPerKg);
    const targetFluidMl = weightKg * Math.max(0, targetFluidMlPerKg);

    return {
      weightKg,
      hours,
      targetEnergyKcal,
      targetProteinG,
      targetFluidMl,
      energyKcalPerKg: safeDivide(calculation.totals.energyKcal, weightKg),
      proteinGPerKg: safeDivide(calculation.totals.proteinG, weightKg),
      lipidGPerKg: safeDivide(calculation.totals.lipidG, weightKg),
      glucoseGPerKg: safeDivide(calculation.totals.glucoseG, weightKg),
      fluidMlPerKg: safeDivide(calculation.totals.totalLiquidMl, weightKg),
      girMgKgMin:
        weightKg > 0 && hours > 0
          ? (calculation.totals.glucoseG * 1000) / (weightKg * hours * 60)
          : 0,
    };
  }, [
    administrationHours,
    calculation.totals.energyKcal,
    calculation.totals.glucoseG,
    calculation.totals.lipidG,
    calculation.totals.proteinG,
    calculation.totals.totalLiquidMl,
    patientWeightKg,
    targetEnergyKcalPerKg,
    targetFluidMlPerKg,
    targetProteinGPerKg,
  ]);
  const clinicalExportRows = useMemo(
    () => [
      {
        label: "Cân nặng",
        value: formatClinicalNutritionNumber(clinicalSummary.weightKg, 1),
        unit: "kg",
      },
      {
        label: "Thời gian nuôi dưỡng",
        value: formatClinicalNutritionNumber(clinicalSummary.hours, 1),
        unit: "giờ",
      },
      {
        label: "Năng lượng/kg",
        value: formatClinicalNutritionNumber(clinicalSummary.energyKcalPerKg, 2),
        unit: "kcal/kg",
      },
      {
        label: "Protein/kg",
        value: formatClinicalNutritionNumber(clinicalSummary.proteinGPerKg, 2),
        unit: "g/kg",
      },
      {
        label: "Lipid/kg",
        value: formatClinicalNutritionNumber(clinicalSummary.lipidGPerKg, 2),
        unit: "g/kg",
      },
      {
        label: "Glucose/kg",
        value: formatClinicalNutritionNumber(clinicalSummary.glucoseGPerKg, 2),
        unit: "g/kg",
      },
      {
        label: "Dịch/kg",
        value: formatClinicalNutritionNumber(clinicalSummary.fluidMlPerKg, 2),
        unit: "ml/kg",
      },
      {
        label: "GIR",
        value: formatClinicalNutritionNumber(clinicalSummary.girMgKgMin, 2),
        unit: "mg/kg/phút",
      },
      {
        label: "NPC:N",
        value: formatClinicalNutritionNumber(
          calculation.totals.nonProteinEnergyNitrogenRatio,
          0,
        ),
        unit: ":1",
      },
      {
        label: "Nitrogen",
        value: formatClinicalNutritionNumber(calculation.totals.nitrogenG, 2),
        unit: "g",
      },
      {
        label: "Non-protein kcal",
        value: formatClinicalNutritionNumber(
          calculation.totals.nonProteinEnergyKcal,
          2,
        ),
        unit: "kcal",
      },
    ],
    [
      calculation.totals.nitrogenG,
      calculation.totals.nonProteinEnergyKcal,
      calculation.totals.nonProteinEnergyNitrogenRatio,
      clinicalSummary.energyKcalPerKg,
      clinicalSummary.fluidMlPerKg,
      clinicalSummary.girMgKgMin,
      clinicalSummary.glucoseGPerKg,
      clinicalSummary.hours,
      clinicalSummary.lipidGPerKg,
      clinicalSummary.proteinGPerKg,
      clinicalSummary.weightKg,
    ],
  );

  const filteredProducts = useMemo(() => {
    const keyword = catalogSearch.trim().toLowerCase();
    if (!keyword) return clinicalProducts;
    return clinicalProducts.filter((product) =>
      `${product.name} ${product.unit} ${product.note || ""}`
        .toLowerCase()
        .includes(keyword),
    );
  }, [catalogSearch, clinicalProducts]);

  const updateLine = (
    lineId: string,
    patch: Partial<ClinicalNutritionLineInput>,
  ) => {
    setLines((currentLines) =>
      currentLines.map((line) =>
        line.id === lineId ? { ...line, ...patch } : line,
      ),
    );
  };

  const addLine = (
    productId = "",
    options?: Partial<Pick<ClinicalNutritionLineInput, "quantity" | "amount" | "note">>,
  ) => {
    const product = productId
      ? findClinicalNutritionProduct(productId, clinicalProducts)
      : null;
    setLines((currentLines) => [
      ...currentLines,
      {
        id: createLineId(),
        productId,
        quantity: options?.quantity ?? 1,
        amount: options?.amount ?? (product ? 100 : 0),
        note: options?.note ?? product?.note ?? "",
      },
    ]);
  };

  const handleSelectNewLineProduct = (productId?: string) => {
    const product = productId
      ? findClinicalNutritionProduct(productId, clinicalProducts)
      : null;
    setNewLineProductId(productId || "");
    setNewLineAmount(product ? 100 : 0);
    setNewLineNote(product?.note || "");
  };

  const addSelectedProductToTable = () => {
    if (!selectedNewLineProduct) {
      messageApi.warning("Vui lòng chọn sản phẩm");
      return;
    }

    addLine(selectedNewLineProduct.id, {
      quantity: Number(newLineQuantity || 0),
      amount: Number(newLineAmount || 0),
      note: newLineNote,
    });
    messageApi.success(`Đã thêm ${selectedNewLineProduct.name}`);
  };

  const resetProductForm = () => {
    setProductForm(EMPTY_PRODUCT_FORM);
  };

  const editClinicalProduct = (product: ClinicalNutritionCatalogProduct) => {
    setProductForm({
      id: product.id,
      name: product.name,
      unit: product.unit,
      proteinPer100: product.proteinPer100,
      lipidPer100: product.lipidPer100,
      glucosePer100: product.glucosePer100,
      energyPer100: product.energyPer100,
      note: product.note || "",
      isActive: product.isActive,
      sortOrder: product.sortOrder,
    });
    document
      .getElementById("clinical-product-form")
      ?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const saveClinicalProduct = async () => {
    if (productForm.name.trim().length < 2) {
      messageApi.warning("Tên sản phẩm tối thiểu 2 ký tự");
      return;
    }

    setIsSavingProduct(true);
    try {
      const response = await fetch("/api/admin/nutrition/clinical-products", {
        method: productForm.id ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(productForm),
      });
      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.error || "Không thể lưu sản phẩm");
      }
      messageApi.success(result.message || "Đã lưu sản phẩm tính toán");
      resetProductForm();
      await loadClinicalProducts();
    } catch (error: unknown) {
      messageApi.error(
        error instanceof Error ? error.message : "Không thể lưu sản phẩm",
      );
    } finally {
      setIsSavingProduct(false);
    }
  };

  const deleteClinicalProduct = async (productId: string) => {
    try {
      const response = await fetch(
        `/api/admin/nutrition/clinical-products?id=${encodeURIComponent(
          productId,
        )}`,
        { method: "DELETE" },
      );
      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.error || "Không thể xóa sản phẩm");
      }
      setLines((currentLines) =>
        currentLines.filter((line) => line.productId !== productId),
      );
      if (newLineProductId === productId) {
        handleSelectNewLineProduct(undefined);
      }
      if (productForm.id === productId) {
        resetProductForm();
      }
      messageApi.success(result.message || "Đã xóa sản phẩm tính toán");
      await loadClinicalProducts();
    } catch (error: unknown) {
      messageApi.error(
        error instanceof Error ? error.message : "Không thể xóa sản phẩm",
      );
    }
  };

  const scrollToAddProduct = () => {
    document
      .getElementById("clinical-add-product")
      ?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const removeLine = (lineId: string) => {
    setLines((currentLines) =>
      currentLines.filter((line) => line.id !== lineId),
    );
  };

  const clearLines = () => {
    setLines([]);
  };

  const copyTable = async () => {
    const rows = buildExportRows(calculation.lines);
    const headers = [
      "Số lượng",
      "Tên sản phẩm",
      "Đơn vị",
      "Hàm lượng",
      "Tổng hàm lượng",
      "Protein (g)",
      "Lipid (g)",
      "Glucose (g)",
      "Năng lượng (kcal)",
      "Chú ý",
    ];
    const summary = [
      "TỔNG",
      "",
      "",
      "",
      "",
      formatClinicalNutritionNumber(calculation.totals.proteinG, 2),
      formatClinicalNutritionNumber(calculation.totals.lipidG, 2),
      formatClinicalNutritionNumber(calculation.totals.glucoseG, 2),
      formatClinicalNutritionNumber(calculation.totals.energyKcal, 2),
      "",
    ];
    const ratio = [
      "P:L:G",
      "",
      "",
      "",
      "",
      formatClinicalNutritionNumber(calculation.totals.proteinEnergyPercent, 2),
      formatClinicalNutritionNumber(calculation.totals.lipidEnergyPercent, 2),
      formatClinicalNutritionNumber(calculation.totals.glucoseEnergyPercent, 2),
      "",
      "",
    ];
    const text = [
      headers.join("\t"),
      ...rows.map((row) =>
        [
          row.quantity,
          row.productName,
          row.unit,
          row.amount,
          row.totalAmount,
          row.proteinG,
          row.lipidG,
          row.glucoseG,
          row.energyKcal,
          row.note,
        ].join("\t"),
      ),
      summary.join("\t"),
      ratio.join("\t"),
      "",
      "CHỈ SỐ LÂM SÀNG",
      ...clinicalExportRows.map((row) =>
        [row.label, row.value, row.unit, "", "", "", "", "", "", ""].join(
          "\t",
        ),
      ),
    ].join("\n");

    try {
      await navigator.clipboard.writeText(text);
      messageApi.success("Đã sao chép bảng");
    } catch {
      messageApi.error("Trình duyệt chưa cho phép sao chép");
    }
  };

  const exportCsv = () => {
    const rows = buildExportRows(calculation.lines);
    const headers = [
      "So luong",
      "Ten san pham",
      "Don vi",
      "Ham luong",
      "Tong ham luong",
      "Protein (g)",
      "Lipid (g)",
      "Glucose (g)",
      "Nang luong (kcal)",
      "Chu y",
    ];
    const csvRows = [
      headers.map(escapeCsvCell).join(","),
      ...rows.map((row) =>
        [
          row.quantity,
          row.productName,
          row.unit,
          row.amount,
          row.totalAmount,
          row.proteinG,
          row.lipidG,
          row.glucoseG,
          row.energyKcal,
          row.note,
        ]
          .map(escapeCsvCell)
          .join(","),
      ),
      [
        "TONG",
        "",
        "",
        "",
        "",
        formatClinicalNutritionNumber(calculation.totals.proteinG, 2),
        formatClinicalNutritionNumber(calculation.totals.lipidG, 2),
        formatClinicalNutritionNumber(calculation.totals.glucoseG, 2),
        formatClinicalNutritionNumber(calculation.totals.energyKcal, 2),
        "",
      ]
        .map(escapeCsvCell)
        .join(","),
      [
        "P:L:G",
        "",
        "",
        "",
        "",
        formatClinicalNutritionNumber(calculation.totals.proteinEnergyPercent, 2),
        formatClinicalNutritionNumber(calculation.totals.lipidEnergyPercent, 2),
        formatClinicalNutritionNumber(calculation.totals.glucoseEnergyPercent, 2),
        "",
        "",
      ]
        .map(escapeCsvCell)
        .join(","),
      "",
      ["CHI SO LAM SANG"].map(escapeCsvCell).join(","),
      ...clinicalExportRows.map((row) =>
        [row.label, row.value, row.unit, "", "", "", "", "", "", ""]
          .map(escapeCsvCell)
          .join(","),
      ),
    ];
    const blob = new Blob([`\ufeff${csvRows.join("\n")}`], {
      type: "text/csv;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `bang-tinh-dinh-duong-${new Date()
      .toISOString()
      .slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const lineColumns: ColumnsType<ClinicalNutritionLineResult> = [
    {
      title: "Số lượng",
      dataIndex: "quantity",
      key: "quantity",
      width: 118,
      render: (_value, record) => (
        <InputNumber
          min={0}
          step={0.25}
          precision={2}
          value={record.quantity}
          onChange={(value) =>
            updateLine(record.id, { quantity: Number(value ?? 0) })
          }
          style={{ width: "100%" }}
        />
      ),
    },
    {
      title: "Tên sản phẩm",
      dataIndex: "productId",
      key: "productId",
      width: 300,
      render: (_value, record) => (
        <Select
          showSearch
          allowClear
          placeholder="Chọn sản phẩm"
          options={productOptions}
          value={record.productId || undefined}
          onChange={(productId?: string) => {
            const product = productId
              ? findClinicalNutritionProduct(productId, clinicalProducts)
              : null;
            updateLine(record.id, {
              productId: productId || "",
              amount: record.amount || (product ? 100 : 0),
              note: record.note || product?.note || "",
            });
          }}
          filterOption={(input, option) =>
            String(option?.label || "")
              .toLowerCase()
              .includes(input.toLowerCase())
          }
          style={{ width: "100%" }}
        />
      ),
    },
    {
      title: "Đơn vị",
      dataIndex: "unit",
      key: "unit",
      width: 82,
      render: (value: string) => (value ? <Tag>{value}</Tag> : "-"),
    },
    {
      title: "Hàm lượng",
      dataIndex: "amount",
      key: "amount",
      width: 128,
      render: (_value, record) => (
        <InputNumber
          min={0}
          step={record.unit === "g" ? 1 : 10}
          precision={2}
          value={record.amount}
          onChange={(value) =>
            updateLine(record.id, { amount: Number(value ?? 0) })
          }
          style={{ width: "100%" }}
        />
      ),
    },
    {
      title: "Tổng hàm lượng",
      dataIndex: "totalAmount",
      key: "totalAmount",
      align: "right",
      width: 140,
      render: (value: number, record) =>
        `${formatClinicalNutritionNumber(value, 2)} ${record.unit}`,
    },
    {
      title: "Protein (g)",
      dataIndex: "proteinG",
      key: "proteinG",
      align: "right",
      width: 118,
      render: (value: number) => formatClinicalNutritionNumber(value, 2),
    },
    {
      title: "Lipid (g)",
      dataIndex: "lipidG",
      key: "lipidG",
      align: "right",
      width: 118,
      render: (value: number) => formatClinicalNutritionNumber(value, 2),
    },
    {
      title: "Glucose (g)",
      dataIndex: "glucoseG",
      key: "glucoseG",
      align: "right",
      width: 124,
      render: (value: number) => formatClinicalNutritionNumber(value, 2),
    },
    {
      title: "Năng lượng (kcal)",
      dataIndex: "energyKcal",
      key: "energyKcal",
      align: "right",
      width: 150,
      render: (value: number) => formatClinicalNutritionNumber(value, 2),
    },
    {
      title: "Chú ý",
      dataIndex: "note",
      key: "note",
      width: 260,
      render: (_value, record) => (
        <Input
          value={record.note || ""}
          onChange={(event) =>
            updateLine(record.id, { note: event.target.value })
          }
        />
      ),
    },
    {
      title: "",
      key: "actions",
      fixed: isMobile ? undefined : "right",
      width: 58,
      render: (_value, record) => (
        <Button
          type="text"
          danger
          icon={<DeleteOutlined />}
          onClick={() => removeLine(record.id)}
          aria-label="Xóa dòng"
        />
      ),
    },
  ];

  const catalogColumns: ColumnsType<ClinicalNutritionCatalogProduct> = [
    {
      title: "Tên sản phẩm",
      dataIndex: "name",
      key: "name",
      width: 280,
    },
    {
      title: "Đơn vị",
      dataIndex: "unit",
      key: "unit",
      width: 90,
      render: (value: string) => <Tag>{value}</Tag>,
    },
    {
      title: "Trạng thái",
      dataIndex: "isActive",
      key: "isActive",
      width: 110,
      render: (value: boolean) => (
        <Tag color={value ? "green" : "default"}>
          {value ? "Đang dùng" : "Ẩn"}
        </Tag>
      ),
    },
    {
      title: "P / 100",
      dataIndex: "proteinPer100",
      key: "proteinPer100",
      align: "right",
      width: 100,
      render: (value: number) => formatClinicalNutritionNumber(value, 2),
    },
    {
      title: "L / 100",
      dataIndex: "lipidPer100",
      key: "lipidPer100",
      align: "right",
      width: 100,
      render: (value: number) => formatClinicalNutritionNumber(value, 2),
    },
    {
      title: "G / 100",
      dataIndex: "glucosePer100",
      key: "glucosePer100",
      align: "right",
      width: 100,
      render: (value: number) => formatClinicalNutritionNumber(value, 2),
    },
    {
      title: "E / 100",
      dataIndex: "energyPer100",
      key: "energyPer100",
      align: "right",
      width: 100,
      render: (value: number) => formatClinicalNutritionNumber(value, 2),
    },
    {
      title: "Ghi chú",
      dataIndex: "note",
      key: "note",
      ellipsis: true,
    },
    {
      title: "Thêm",
      key: "add",
      fixed: isMobile ? undefined : "right",
      width: 210,
      render: (_value, record) => (
        <Space>
          <Button
            size="small"
            icon={<PlusOutlined />}
            onClick={() => addLine(record.id)}
            disabled={!record.isActive}
            aria-label={`Thêm ${record.name}`}
          >
            Thêm
          </Button>
          <Button size="small" onClick={() => editClinicalProduct(record)}>
            Sửa
          </Button>
          <Popconfirm
            title="Xóa sản phẩm này?"
            okText="Xóa"
            cancelText="Hủy"
            onConfirm={() => deleteClinicalProduct(record.id)}
          >
            <Button size="small" danger>
              Xóa
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <div className="min-h-screen bg-[#f5f5f5] p-2 pb-28 sm:p-4 md:pb-4">
      {contextHolder}

      <Space
        orientation="vertical"
        size={isMobile ? 10 : 16}
        style={{ width: "100%" }}
      >
        <div>
          <Typography.Title
            level={2}
            className="!mb-1 !text-[20px] !leading-tight sm:!text-[30px]"
          >
            Bảng phối sản phẩm dinh dưỡng lâm sàng
          </Typography.Title>
          <Typography.Text type="secondary">
            Dữ liệu P/L/G/E được nhập từ bảng sản phẩm bạn cung cấp.
          </Typography.Text>
        </div>

        <Alert
          type="info"
          showIcon
          title="Công cụ hỗ trợ tính khẩu phần"
          description="Các chỉ số được quy đổi từ hàm lượng sản phẩm theo 100 đơn vị. Bác sĩ/chuyên gia dinh dưỡng vẫn là người quyết định mục tiêu và phác đồ cuối cùng."
        />

        <Card title="Thông tin bệnh nhân và mục tiêu" styles={cardStyles}>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-5">
            <div>
              <Typography.Text strong>Cân nặng</Typography.Text>
              <Space.Compact style={{ marginTop: 6, width: "100%" }}>
                <InputNumber
                  size={controlSize}
                  min={0}
                  precision={1}
                  value={patientWeightKg}
                  onChange={(value) => setPatientWeightKg(Number(value ?? 0))}
                  style={{ flex: 1, width: "100%" }}
                />
                <Input
                  size={controlSize}
                  value="kg"
                  readOnly
                  style={{ width: 72, textAlign: "center" }}
                />
              </Space.Compact>
            </div>
            <div>
              <Typography.Text strong>Thời gian nuôi dưỡng</Typography.Text>
              <Space.Compact style={{ marginTop: 6, width: "100%" }}>
                <InputNumber
                  size={controlSize}
                  min={0}
                  max={24}
                  precision={1}
                  value={administrationHours}
                  onChange={(value) =>
                    setAdministrationHours(Number(value ?? 0))
                  }
                  style={{ flex: 1, width: "100%" }}
                />
                <Input
                  size={controlSize}
                  value="giờ"
                  readOnly
                  style={{ width: 72, textAlign: "center" }}
                />
              </Space.Compact>
            </div>
            <div>
              <Typography.Text strong>Năng lượng mục tiêu</Typography.Text>
              <Space.Compact style={{ marginTop: 6, width: "100%" }}>
                <InputNumber
                  size={controlSize}
                  min={0}
                  precision={1}
                  value={targetEnergyKcalPerKg}
                  onChange={(value) =>
                    setTargetEnergyKcalPerKg(Number(value ?? 0))
                  }
                  style={{ flex: 1, width: "100%" }}
                />
                <Input
                  size={controlSize}
                  value="kcal/kg"
                  readOnly
                  style={{ width: 88, textAlign: "center" }}
                />
              </Space.Compact>
            </div>
            <div>
              <Typography.Text strong>Protein mục tiêu</Typography.Text>
              <Space.Compact style={{ marginTop: 6, width: "100%" }}>
                <InputNumber
                  size={controlSize}
                  min={0}
                  precision={2}
                  value={targetProteinGPerKg}
                  onChange={(value) =>
                    setTargetProteinGPerKg(Number(value ?? 0))
                  }
                  style={{ flex: 1, width: "100%" }}
                />
                <Input
                  size={controlSize}
                  value="g/kg"
                  readOnly
                  style={{ width: 72, textAlign: "center" }}
                />
              </Space.Compact>
            </div>
            <div>
              <Typography.Text strong>Dịch mục tiêu</Typography.Text>
              <Space.Compact style={{ marginTop: 6, width: "100%" }}>
                <InputNumber
                  size={controlSize}
                  min={0}
                  precision={1}
                  value={targetFluidMlPerKg}
                  onChange={(value) =>
                    setTargetFluidMlPerKg(Number(value ?? 0))
                  }
                  style={{ flex: 1, width: "100%" }}
                />
                <Input
                  size={controlSize}
                  value="ml/kg"
                  readOnly
                  style={{ width: 76, textAlign: "center" }}
                />
              </Space.Compact>
            </div>
          </div>
          <Typography.Text
            type="secondary"
            style={{ display: "block", marginTop: 12 }}
          >
            Dịch/kg chỉ tính các dòng có đơn vị ml. Với sản phẩm bột, thêm nước
            pha như một dòng riêng nếu cần tính tổng dịch.
          </Typography.Text>
        </Card>

        <Card
          id="clinical-add-product"
          title="Thêm sản phẩm để tính toán"
          styles={cardStyles}
        >
          <div className="grid grid-cols-1 gap-3 lg:grid-cols-[minmax(260px,1fr)_140px_160px_minmax(220px,1fr)_auto] lg:items-end">
            <div>
              <Typography.Text strong>Sản phẩm</Typography.Text>
              <Select
                size={controlSize}
                showSearch
                allowClear
                placeholder="Chọn sản phẩm"
                options={productOptions}
                value={newLineProductId || undefined}
                onChange={handleSelectNewLineProduct}
                filterOption={(input, option) =>
                  String(option?.label || "")
                    .toLowerCase()
                    .includes(input.toLowerCase())
                }
                style={{ marginTop: 6, width: "100%" }}
              />
              {selectedNewLineProduct ? (
                <div className="mt-2 flex flex-wrap items-center gap-1">
                  <Tag style={{ margin: 0 }}>{selectedNewLineProduct.unit}</Tag>
                  <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                    P{" "}
                    {formatClinicalNutritionNumber(
                      selectedNewLineProduct.proteinPer100,
                      2,
                    )}{" "}
                    / L{" "}
                    {formatClinicalNutritionNumber(
                      selectedNewLineProduct.lipidPer100,
                      2,
                    )}{" "}
                    / G{" "}
                    {formatClinicalNutritionNumber(
                      selectedNewLineProduct.glucosePer100,
                      2,
                    )}{" "}
                    / E{" "}
                    {formatClinicalNutritionNumber(
                      selectedNewLineProduct.energyPer100,
                      2,
                    )}
                  </Typography.Text>
                </div>
              ) : null}
            </div>

            <div>
              <Typography.Text strong>Số lượng</Typography.Text>
              <InputNumber
                size={controlSize}
                min={0}
                step={0.25}
                precision={2}
                value={newLineQuantity}
                onChange={(value) => setNewLineQuantity(Number(value ?? 0))}
                style={{ marginTop: 6, width: "100%" }}
              />
            </div>

            <div>
              <Typography.Text strong>Hàm lượng</Typography.Text>
              <Space.Compact style={{ marginTop: 6, width: "100%" }}>
                <InputNumber
                  size={controlSize}
                  min={0}
                  step={selectedNewLineProduct?.unit === "g" ? 1 : 10}
                  precision={2}
                  value={newLineAmount}
                  onChange={(value) => setNewLineAmount(Number(value ?? 0))}
                  style={{ flex: 1, width: "100%" }}
                />
                <Input
                  size={controlSize}
                  value={selectedNewLineProduct?.unit || "-"}
                  readOnly
                  style={{ width: 64, textAlign: "center" }}
                />
              </Space.Compact>
            </div>

            <div>
              <Typography.Text strong>Chú ý</Typography.Text>
              <Input
                size={controlSize}
                value={newLineNote}
                onChange={(event) => setNewLineNote(event.target.value)}
                style={{ marginTop: 6 }}
              />
            </div>

            <Button
              size={controlSize}
              type="primary"
              icon={<PlusOutlined />}
              onClick={addSelectedProductToTable}
              disabled={!selectedNewLineProduct}
              className="w-full lg:w-auto"
            >
              Thêm vào bảng
            </Button>
          </div>

          {newLinePreview ? (
            <div className="mt-4 grid grid-cols-2 gap-2 rounded-md border border-gray-200 bg-gray-50 p-3 md:grid-cols-5 md:gap-3">
              <Statistic
                title="Tổng hàm lượng"
                value={formatClinicalNutritionNumber(
                  newLinePreview.totalAmount,
                  2,
                )}
                suffix={newLinePreview.unit}
              />
              <Statistic
                title="Protein"
                value={formatClinicalNutritionNumber(newLinePreview.proteinG, 2)}
                suffix="g"
              />
              <Statistic
                title="Lipid"
                value={formatClinicalNutritionNumber(newLinePreview.lipidG, 2)}
                suffix="g"
              />
              <Statistic
                title="Glucose"
                value={formatClinicalNutritionNumber(newLinePreview.glucoseG, 2)}
                suffix="g"
              />
              <Statistic
                title="Năng lượng"
                value={formatClinicalNutritionNumber(
                  newLinePreview.energyKcal,
                  2,
                )}
                suffix="kcal"
              />
            </div>
          ) : null}
        </Card>

        <Card title="Tổng hợp lâm sàng" styles={cardStyles}>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:gap-3 xl:grid-cols-6">
            <Statistic
              title="Protein"
              value={formatClinicalNutritionNumber(
                calculation.totals.proteinG,
                2,
              )}
              suffix="g"
              styles={{ content: { color: "#389e0d" } }}
            />
            <Statistic
              title="Lipid"
              value={formatClinicalNutritionNumber(calculation.totals.lipidG, 2)}
              suffix="g"
              styles={{ content: { color: "#d48806" } }}
            />
            <Statistic
              title="Glucose"
              value={formatClinicalNutritionNumber(
                calculation.totals.glucoseG,
                2,
              )}
              suffix="g"
              styles={{ content: { color: "#1677ff" } }}
            />
            <Statistic
              title="Năng lượng"
              value={formatClinicalNutritionNumber(
                calculation.totals.energyKcal,
                2,
              )}
              suffix="kcal"
              styles={{ content: { color: "#0958d9" } }}
            />
            <Statistic
              title="Tổng dịch"
              value={formatClinicalNutritionNumber(
                calculation.totals.totalLiquidMl,
                2,
              )}
              suffix="ml"
            />
            <Statistic
              title="Bột/khối lượng khô"
              value={formatClinicalNutritionNumber(
                calculation.totals.totalPowderG,
                2,
              )}
              suffix="g"
            />
          </div>

          <div
            className="mt-4 grid grid-cols-2 gap-2 md:grid-cols-3 md:gap-3 xl:grid-cols-6"
            style={{ alignItems: "stretch" }}
          >
            <div>
              <Typography.Text type="secondary">P:L:G</Typography.Text>
              <div style={{ marginTop: 6 }}>
                <Tag color="green" style={{ marginBottom: 4 }}>
                  P{" "}
                  {formatClinicalNutritionNumber(
                    calculation.totals.proteinEnergyPercent,
                    2,
                  )}
                  %
                </Tag>
                <Tag color="gold" style={{ marginBottom: 4 }}>
                  L{" "}
                  {formatClinicalNutritionNumber(
                    calculation.totals.lipidEnergyPercent,
                    2,
                  )}
                  %
                </Tag>
                <Tag color="blue" style={{ marginBottom: 4 }}>
                  G{" "}
                  {formatClinicalNutritionNumber(
                    calculation.totals.glucoseEnergyPercent,
                    2,
                  )}
                  %
                </Tag>
              </div>
            </div>
            <Statistic
              title="Năng lượng/kg"
              value={formatClinicalNutritionNumber(
                clinicalSummary.energyKcalPerKg,
                2,
              )}
              suffix="kcal/kg"
            />
            <Statistic
              title="Protein/kg"
              value={formatClinicalNutritionNumber(
                clinicalSummary.proteinGPerKg,
                2,
              )}
              suffix="g/kg"
            />
            <Statistic
              title="GIR"
              value={formatClinicalNutritionNumber(
                clinicalSummary.girMgKgMin,
                2,
              )}
              suffix="mg/kg/phút"
            />
            <Statistic
              title="NPC:N"
              value={formatClinicalNutritionNumber(
                calculation.totals.nonProteinEnergyNitrogenRatio,
                0,
              )}
              suffix=":1"
            />
            <Statistic
              title="Kcal/ml"
              value={formatClinicalNutritionNumber(
                calculation.totals.energyDensityKcalPerMl,
                2,
              )}
              suffix="kcal/ml"
            />
          </div>

          <div className="mt-4 grid grid-cols-1 gap-3 xl:grid-cols-3">
            <TargetProgress
              title="Năng lượng"
              actual={calculation.totals.energyKcal}
              target={clinicalSummary.targetEnergyKcal}
              suffix="kcal"
            />
            <TargetProgress
              title="Protein"
              actual={calculation.totals.proteinG}
              target={clinicalSummary.targetProteinG}
              suffix="g"
            />
            <TargetProgress
              title="Dịch"
              actual={calculation.totals.totalLiquidMl}
              target={clinicalSummary.targetFluidMl}
              suffix="ml"
            />
          </div>

          <div className="mt-4 grid grid-cols-2 gap-2 md:gap-3 xl:grid-cols-4">
            <Statistic
              title="Lipid/kg"
              value={formatClinicalNutritionNumber(
                clinicalSummary.lipidGPerKg,
                2,
              )}
              suffix="g/kg"
            />
            <Statistic
              title="Glucose/kg"
              value={formatClinicalNutritionNumber(
                clinicalSummary.glucoseGPerKg,
                2,
              )}
              suffix="g/kg"
            />
            <Statistic
              title="Nitrogen"
              value={formatClinicalNutritionNumber(
                calculation.totals.nitrogenG,
                2,
              )}
              suffix="g"
            />
            <Statistic
              title="Non-protein kcal"
              value={formatClinicalNutritionNumber(
                calculation.totals.nonProteinEnergyKcal,
                2,
              )}
              suffix="kcal"
            />
          </div>

          <div className="mt-4 flex flex-wrap justify-end gap-2">
            <Typography.Text type="secondary" style={{ marginRight: "auto" }}>
              Số dòng:{" "}
              {calculation.lines.filter((line) => line.product).length}
            </Typography.Text>
            <Space
              wrap
              className="w-full sm:w-auto"
              style={{ justifyContent: isMobile ? "stretch" : "flex-end" }}
            >
              <Button
                size={controlSize}
                icon={<PlusOutlined />}
                onClick={() => addLine()}
                className={isMobile ? "flex-1" : undefined}
              >
                Thêm dòng
              </Button>
              <Button
                size={controlSize}
                icon={<CopyOutlined />}
                onClick={copyTable}
                className={isMobile ? "flex-1" : undefined}
              >
                Sao chép
              </Button>
              <Button
                size={controlSize}
                icon={<DownloadOutlined />}
                onClick={exportCsv}
                className={isMobile ? "flex-1" : undefined}
              >
                CSV
              </Button>
            </Space>
          </div>
        </Card>

        <Card styles={cardStyles}>
          <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <Typography.Title level={4} style={{ margin: 0 }}>
              Bảng tính toán
            </Typography.Title>
            <Space wrap>
              <Popconfirm
                title="Xóa toàn bộ dòng hiện tại?"
                okText="Xóa"
                cancelText="Hủy"
                onConfirm={clearLines}
              >
                <Button size={controlSize} danger icon={<DeleteOutlined />}>
                  Xóa bảng
                </Button>
              </Popconfirm>
            </Space>
          </div>
          {isMobile ? (
            <div className="space-y-3">
              {calculation.lines.length ? (
                calculation.lines.map((line) => (
                  <MobileCalculationLineCard
                    key={line.id}
                    record={line}
                    productOptions={productOptions}
                    clinicalProducts={clinicalProducts}
                    updateLine={updateLine}
                    removeLine={removeLine}
                  />
                ))
              ) : (
                <div className="rounded-md border border-dashed border-gray-300 bg-white p-4 text-center">
                  <Typography.Text type="secondary">
                    Chưa có dòng tính toán. Chọn sản phẩm ở phần trên để bắt đầu.
                  </Typography.Text>
                </div>
              )}

              {calculation.lines.length ? (
                <div className="rounded-md border border-blue-100 bg-blue-50 p-3">
                  <Typography.Text strong>Tổng nhanh</Typography.Text>
                  <div className="mt-3 grid grid-cols-2 gap-2">
                    <MobileMetric
                      label="Protein"
                      value={formatClinicalNutritionNumber(
                        calculation.totals.proteinG,
                        2,
                      )}
                      unit="g"
                      color="#389e0d"
                    />
                    <MobileMetric
                      label="Lipid"
                      value={formatClinicalNutritionNumber(
                        calculation.totals.lipidG,
                        2,
                      )}
                      unit="g"
                      color="#d48806"
                    />
                    <MobileMetric
                      label="Glucose"
                      value={formatClinicalNutritionNumber(
                        calculation.totals.glucoseG,
                        2,
                      )}
                      unit="g"
                      color="#1677ff"
                    />
                    <MobileMetric
                      label="Năng lượng"
                      value={formatClinicalNutritionNumber(
                        calculation.totals.energyKcal,
                        2,
                      )}
                      unit="kcal"
                      color="#0958d9"
                    />
                  </div>
                  <div className="mt-2 flex flex-wrap gap-1">
                    <Tag color="green" style={{ margin: 0 }}>
                      P{" "}
                      {formatClinicalNutritionNumber(
                        calculation.totals.proteinEnergyPercent,
                        2,
                      )}
                      %
                    </Tag>
                    <Tag color="gold" style={{ margin: 0 }}>
                      L{" "}
                      {formatClinicalNutritionNumber(
                        calculation.totals.lipidEnergyPercent,
                        2,
                      )}
                      %
                    </Tag>
                    <Tag color="blue" style={{ margin: 0 }}>
                      G{" "}
                      {formatClinicalNutritionNumber(
                        calculation.totals.glucoseEnergyPercent,
                        2,
                      )}
                      %
                    </Tag>
                  </div>
                </div>
              ) : null}
            </div>
          ) : (
            <Table
              rowKey="id"
              columns={lineColumns}
              dataSource={calculation.lines}
              pagination={false}
              size="middle"
              scroll={{ x: 1500 }}
              summary={() => (
                <Table.Summary fixed>
                  <Table.Summary.Row>
                    <Table.Summary.Cell index={0} colSpan={5}>
                      <Typography.Text strong>TỔNG</Typography.Text>
                    </Table.Summary.Cell>
                    <Table.Summary.Cell index={5} align="right">
                      <Typography.Text strong>
                        {formatClinicalNutritionNumber(
                          calculation.totals.proteinG,
                          2,
                        )}
                      </Typography.Text>
                    </Table.Summary.Cell>
                    <Table.Summary.Cell index={6} align="right">
                      <Typography.Text strong>
                        {formatClinicalNutritionNumber(
                          calculation.totals.lipidG,
                          2,
                        )}
                      </Typography.Text>
                    </Table.Summary.Cell>
                    <Table.Summary.Cell index={7} align="right">
                      <Typography.Text strong>
                        {formatClinicalNutritionNumber(
                          calculation.totals.glucoseG,
                          2,
                        )}
                      </Typography.Text>
                    </Table.Summary.Cell>
                    <Table.Summary.Cell index={8} align="right">
                      <Typography.Text strong>
                        {formatClinicalNutritionNumber(
                          calculation.totals.energyKcal,
                          2,
                        )}
                      </Typography.Text>
                    </Table.Summary.Cell>
                    <Table.Summary.Cell index={9} colSpan={2} />
                  </Table.Summary.Row>
                  <Table.Summary.Row>
                    <Table.Summary.Cell index={0} colSpan={5}>
                      <Typography.Text strong>P:L:G</Typography.Text>
                    </Table.Summary.Cell>
                    <Table.Summary.Cell index={5} align="right">
                      {formatClinicalNutritionNumber(
                        calculation.totals.proteinEnergyPercent,
                        2,
                      )}
                    </Table.Summary.Cell>
                    <Table.Summary.Cell index={6} align="right">
                      {formatClinicalNutritionNumber(
                        calculation.totals.lipidEnergyPercent,
                        2,
                      )}
                    </Table.Summary.Cell>
                    <Table.Summary.Cell index={7} align="right">
                      {formatClinicalNutritionNumber(
                        calculation.totals.glucoseEnergyPercent,
                        2,
                      )}
                    </Table.Summary.Cell>
                    <Table.Summary.Cell index={8} />
                    <Table.Summary.Cell index={9} colSpan={2} />
                  </Table.Summary.Row>
                </Table.Summary>
              )}
            />
          )}
        </Card>

        <Card styles={cardStyles}>
          <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <Typography.Title level={4} style={{ margin: 0 }}>
              Danh mục sản phẩm tính toán
            </Typography.Title>
            <Input.Search
              size={controlSize}
              allowClear
              placeholder="Tìm sản phẩm"
              value={catalogSearch}
              onChange={(event) => setCatalogSearch(event.target.value)}
              style={{ width: isMobile ? "100%" : 260 }}
            />
          </div>
          <div
            id="clinical-product-form"
            className="mb-4 rounded-md border border-gray-200 bg-gray-50 p-3"
          >
            <div className="mb-3 flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
              <Typography.Text strong>
                {productForm.id ? "Sửa sản phẩm" : "Thêm sản phẩm tính toán"}
              </Typography.Text>
              {productForm.id ? (
                <Button size="small" onClick={resetProductForm}>
                  Hủy sửa
                </Button>
              ) : null}
            </div>
            <div className="grid grid-cols-2 gap-3 md:grid-cols-2 xl:grid-cols-6">
              <div className="col-span-2 xl:col-span-2">
                <Typography.Text strong>Tên sản phẩm</Typography.Text>
                <Input
                  size={controlSize}
                  value={productForm.name}
                  onChange={(event) =>
                    setProductForm((current) => ({
                      ...current,
                      name: event.target.value,
                    }))
                  }
                  placeholder="Ví dụ: Ensure Gold vani bột"
                  style={{ marginTop: 6 }}
                />
              </div>
              <div>
                <Typography.Text strong>Đơn vị</Typography.Text>
                <Select
                  size={controlSize}
                  value={productForm.unit}
                  options={[
                    { label: "ml", value: "ml" },
                    { label: "g", value: "g" },
                  ]}
                  onChange={(unit: ClinicalNutritionUnit) =>
                    setProductForm((current) => ({ ...current, unit }))
                  }
                  style={{ marginTop: 6, width: "100%" }}
                />
              </div>
              <div>
                <Typography.Text strong>P / 100</Typography.Text>
                <InputNumber
                  size={controlSize}
                  min={0}
                  precision={4}
                  value={productForm.proteinPer100}
                  onChange={(value) =>
                    setProductForm((current) => ({
                      ...current,
                      proteinPer100: Number(value ?? 0),
                    }))
                  }
                  style={{ marginTop: 6, width: "100%" }}
                />
              </div>
              <div>
                <Typography.Text strong>L / 100</Typography.Text>
                <InputNumber
                  size={controlSize}
                  min={0}
                  precision={4}
                  value={productForm.lipidPer100}
                  onChange={(value) =>
                    setProductForm((current) => ({
                      ...current,
                      lipidPer100: Number(value ?? 0),
                    }))
                  }
                  style={{ marginTop: 6, width: "100%" }}
                />
              </div>
              <div>
                <Typography.Text strong>G / 100</Typography.Text>
                <InputNumber
                  size={controlSize}
                  min={0}
                  precision={4}
                  value={productForm.glucosePer100}
                  onChange={(value) =>
                    setProductForm((current) => ({
                      ...current,
                      glucosePer100: Number(value ?? 0),
                    }))
                  }
                  style={{ marginTop: 6, width: "100%" }}
                />
              </div>
              <div>
                <Typography.Text strong>E / 100</Typography.Text>
                <InputNumber
                  size={controlSize}
                  min={0}
                  precision={4}
                  value={productForm.energyPer100}
                  onChange={(value) =>
                    setProductForm((current) => ({
                      ...current,
                      energyPer100: Number(value ?? 0),
                    }))
                  }
                  style={{ marginTop: 6, width: "100%" }}
                />
              </div>
              <div>
                <Typography.Text strong>Thứ tự</Typography.Text>
                <InputNumber
                  size={controlSize}
                  min={0}
                  precision={0}
                  value={productForm.sortOrder}
                  onChange={(value) =>
                    setProductForm((current) => ({
                      ...current,
                      sortOrder: Number(value ?? 0),
                    }))
                  }
                  style={{ marginTop: 6, width: "100%" }}
                />
              </div>
              <div className="col-span-2 xl:col-span-3">
                <Typography.Text strong>Ghi chú</Typography.Text>
                <Input
                  size={controlSize}
                  value={productForm.note}
                  onChange={(event) =>
                    setProductForm((current) => ({
                      ...current,
                      note: event.target.value,
                    }))
                  }
                  placeholder="Cách pha, lưu ý lâm sàng..."
                  style={{ marginTop: 6 }}
                />
              </div>
              <div>
                <Typography.Text strong>Trạng thái</Typography.Text>
                <div style={{ marginTop: 10 }}>
                  <Switch
                    checked={productForm.isActive}
                    checkedChildren="Dùng"
                    unCheckedChildren="Ẩn"
                    onChange={(isActive) =>
                      setProductForm((current) => ({ ...current, isActive }))
                    }
                  />
                </div>
              </div>
              <div className="col-span-2 flex items-end xl:col-span-1">
                <Button
                  size={controlSize}
                  type="primary"
                  icon={<PlusOutlined />}
                  loading={isSavingProduct}
                  onClick={saveClinicalProduct}
                  className="w-full"
                >
                  {productForm.id ? "Lưu sửa" : "Thêm sản phẩm"}
                </Button>
              </div>
            </div>
          </div>
          {isMobile ? (
            <div className="space-y-3">
              {isLoadingProducts ? (
                <div className="rounded-md border border-gray-200 bg-white p-4 text-center">
                  <Typography.Text type="secondary">
                    Đang tải danh mục sản phẩm...
                  </Typography.Text>
                </div>
              ) : filteredProducts.length ? (
                filteredProducts.map((product) => (
                  <MobileCatalogProductCard
                    key={product.id}
                    product={product}
                    addLine={addLine}
                    editClinicalProduct={editClinicalProduct}
                    deleteClinicalProduct={deleteClinicalProduct}
                  />
                ))
              ) : (
                <div className="rounded-md border border-dashed border-gray-300 bg-white p-4 text-center">
                  <Typography.Text type="secondary">
                    Không có sản phẩm phù hợp.
                  </Typography.Text>
                </div>
              )}
            </div>
          ) : (
            <Table
              rowKey="id"
              columns={catalogColumns}
              dataSource={filteredProducts}
              loading={isLoadingProducts}
              size="small"
              pagination={{ pageSize: 8, showSizeChanger: false }}
              scroll={{ x: 1180 }}
            />
          )}
        </Card>
      </Space>

      <div className="fixed bottom-0 left-0 right-0 z-[900] border-t border-gray-200 bg-white px-3 py-2 shadow-[0_-8px_24px_rgba(15,23,42,0.12)] md:hidden">
        <div className="grid grid-cols-[1fr_1fr_1fr_auto] items-center gap-2">
          <div>
            <Typography.Text type="secondary" style={{ fontSize: 11 }}>
              kcal
            </Typography.Text>
            <div className="font-semibold leading-tight">
              {formatClinicalNutritionNumber(calculation.totals.energyKcal, 0)}
            </div>
          </div>
          <div>
            <Typography.Text type="secondary" style={{ fontSize: 11 }}>
              Protein
            </Typography.Text>
            <div className="font-semibold leading-tight">
              {formatClinicalNutritionNumber(calculation.totals.proteinG, 1)}g
            </div>
          </div>
          <div>
            <Typography.Text type="secondary" style={{ fontSize: 11 }}>
              Dịch
            </Typography.Text>
            <div className="font-semibold leading-tight">
              {formatClinicalNutritionNumber(calculation.totals.totalLiquidMl, 0)}
              ml
            </div>
          </div>
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={scrollToAddProduct}
          />
        </div>
      </div>
    </div>
  );
}
