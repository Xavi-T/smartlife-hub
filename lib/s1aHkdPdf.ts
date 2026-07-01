import type {
  Content,
  TableCell,
  TDocumentDefinitions,
} from "pdfmake/interfaces";
import {
  getS1aHkdDescription,
  type S1aHkdBusinessInfo,
  type S1aHkdDescriptionMode,
  type S1aHkdEntry,
} from "@/types/tax-report";

export interface S1aHkdPdfOptions {
  businessInfo: S1aHkdBusinessInfo;
  entries: S1aHkdEntry[];
  descriptionMode: S1aHkdDescriptionMode;
  signingDate: Date;
}

const formatAmount = new Intl.NumberFormat("vi-VN", {
  maximumFractionDigits: 0,
});

const formatDate = new Intl.DateTimeFormat("vi-VN", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  timeZone: "Asia/Ho_Chi_Minh",
});

function makeLabelValue(label: string, value: string): Content {
  return {
    text: [
      { text: `${label}: `, bold: true },
      { text: value || "........................................" },
    ],
    margin: [0, 0, 0, 3],
  };
}

function buildTableBody(
  entries: S1aHkdEntry[],
  descriptionMode: S1aHkdDescriptionMode,
): TableCell[][] {
  const body: TableCell[][] = [
    [
      {
        text: "Ngày tháng",
        bold: true,
        alignment: "center",
        margin: [0, 4, 0, 4],
      },
      {
        text: "Diễn giải",
        bold: true,
        alignment: "center",
        margin: [0, 4, 0, 4],
      },
      {
        text: "Số tiền",
        bold: true,
        alignment: "center",
        margin: [0, 4, 0, 4],
      },
    ],
    [
      { text: "A", bold: true, alignment: "center" },
      { text: "B", bold: true, alignment: "center" },
      { text: "1", bold: true, alignment: "center" },
    ],
  ];

  entries.forEach((entry) => {
    body.push([
      {
        text: formatDate.format(new Date(entry.completedAt)),
        alignment: "center",
        margin: [0, 3, 0, 3],
      },
      {
        text: getS1aHkdDescription(entry, descriptionMode),
        margin: [0, 3, 0, 3],
      },
      {
        text: formatAmount.format(Math.round(entry.amount)),
        alignment: "right",
        margin: [0, 3, 0, 3],
      },
    ]);
  });

  const totalAmount = entries.reduce((sum, entry) => sum + entry.amount, 0);
  body.push([
    { text: "" },
    {
      text: "Tổng cộng",
      bold: true,
      alignment: "center",
      margin: [0, 4, 0, 4],
    },
    {
      text: formatAmount.format(Math.round(totalAmount)),
      bold: true,
      alignment: "right",
      margin: [0, 4, 0, 4],
    },
  ]);

  return body;
}

function buildSigningDate(
  signingLocation: string,
  signingDate: Date,
): string {
  const location = signingLocation.trim();
  const dateText = `ngày ${signingDate.getDate()} tháng ${
    signingDate.getMonth() + 1
  } năm ${signingDate.getFullYear()}`;
  return location
    ? `${location}, ${dateText}`
    : `Ngày ${signingDate.getDate()} tháng ${
        signingDate.getMonth() + 1
      } năm ${signingDate.getFullYear()}`;
}

function buildDocumentDefinition({
  businessInfo,
  entries,
  descriptionMode,
  signingDate,
}: S1aHkdPdfOptions): TDocumentDefinitions {
  const signatureContent: Content[] = [
    {
      text: buildSigningDate(businessInfo.signingLocation, signingDate),
      italics: true,
      alignment: "center",
      margin: [0, 12, 0, 2],
    },
    {
      text: "NGƯỜI ĐẠI DIỆN HỘ KINH DOANH/\nCÁ NHÂN KINH DOANH",
      bold: true,
      alignment: "center",
    },
    {
      text: "(Ký, ghi rõ họ tên, đóng dấu (nếu có))",
      italics: true,
      alignment: "center",
    },
    {
      text: businessInfo.representativeName || "",
      bold: true,
      alignment: "center",
      margin: [0, 42, 0, 0],
    },
  ];

  return {
    pageSize: "A4",
    pageOrientation: "portrait",
    pageMargins: [38, 34, 38, 42],
    info: {
      title: `Sổ S1a-HKD - ${businessInfo.declarationPeriod}`,
      author: businessInfo.householdName,
      subject: "Sổ doanh thu bán hàng hóa, dịch vụ",
      keywords: "S1a-HKD, doanh thu, hộ kinh doanh",
    },
    defaultStyle: {
      font: "Roboto",
      fontSize: 10,
      lineHeight: 1.15,
    },
    footer: (currentPage, pageCount) => ({
      text: `Trang ${currentPage}/${pageCount}`,
      alignment: "center",
      fontSize: 8,
      color: "#666666",
      margin: [0, 12, 0, 0],
    }),
    content: [
      {
        columns: [
          {
            width: "*",
            stack: [
              makeLabelValue(
                "HỘ, CÁ NHÂN KINH DOANH",
                businessInfo.householdName,
              ),
              makeLabelValue("Địa chỉ", businessInfo.address),
              makeLabelValue("Mã số thuế", businessInfo.taxCode),
            ],
          },
          {
            width: 220,
            stack: [
              {
                text: "Mẫu số S1a-HKD",
                bold: true,
                alignment: "center",
                fontSize: 11,
              },
              {
                text:
                  "(Kèm theo Thông tư số 152/2025/TT-BTC\n" +
                  "ngày 31 tháng 12 năm 2025 của Bộ trưởng\n" +
                  "Bộ Tài chính)",
                italics: true,
                alignment: "center",
                fontSize: 9,
              },
            ],
          },
        ],
        columnGap: 16,
      },
      {
        text: "SỔ DOANH THU BÁN HÀNG HÓA, DỊCH VỤ",
        bold: true,
        alignment: "center",
        fontSize: 14,
        margin: [0, 26, 0, 4],
      },
      {
        text: `Địa điểm kinh doanh: ${
          businessInfo.businessLocation || "................................"
        }`,
        alignment: "center",
      },
      {
        text: `Kỳ kê khai: ${
          businessInfo.declarationPeriod || "................................"
        }`,
        alignment: "center",
        margin: [0, 2, 0, 12],
      },
      {
        text: `Đơn vị tính: ${businessInfo.unit || "Đồng"}`,
        italics: true,
        alignment: "right",
        margin: [0, 0, 0, 2],
      },
      {
        table: {
          headerRows: 2,
          widths: [82, "*", 108],
          dontBreakRows: true,
          body: buildTableBody(entries, descriptionMode),
        },
        layout: {
          hLineWidth: () => 0.8,
          vLineWidth: () => 0.8,
          hLineColor: () => "#000000",
          vLineColor: () => "#000000",
          paddingLeft: () => 5,
          paddingRight: () => 5,
          paddingTop: () => 2,
          paddingBottom: () => 2,
        },
      },
      {
        columns: [
          { width: "*", text: "" },
          {
            width: 270,
            stack: signatureContent,
          },
        ],
      },
    ],
  };
}

function sanitizeFileName(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/gi, "d")
    .replace(/[^a-zA-Z0-9-_]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase();
}

export async function downloadS1aHkdPdf(
  options: S1aHkdPdfOptions,
): Promise<void> {
  const [pdfMakeModule, pdfFontsModule] = await Promise.all([
    import("pdfmake/build/pdfmake"),
    import("pdfmake/build/vfs_fonts"),
  ]);

  const pdfMake =
    "default" in pdfMakeModule ? pdfMakeModule.default : pdfMakeModule;
  const pdfFonts =
    "default" in pdfFontsModule ? pdfFontsModule.default : pdfFontsModule;

  pdfMake.addVirtualFileSystem(pdfFonts);

  const periodName =
    sanitizeFileName(options.businessInfo.declarationPeriod) ||
    new Date().toISOString().slice(0, 10);
  await pdfMake
    .createPdf(buildDocumentDefinition(options))
    .download(`so-s1a-hkd-${periodName}.pdf`);
}
