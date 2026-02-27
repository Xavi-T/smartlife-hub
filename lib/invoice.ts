import { APP_CONFIG } from "@/lib/appConfig";
import { formatCurrency } from "@/lib/utils";

export interface InvoiceLineItem {
  name: string;
  quantity: number;
  unitPrice: number;
  subtotal: number;
}

export interface InvoicePayload {
  orderId: string;
  orderDate: string;
  customerName: string;
  customerPhone: string;
  customerAddress?: string | null;
  notes?: string | null;
  totalAmount: number;
  items: InvoiceLineItem[];
}

export interface InvoiceVatOptions {
  vatPercent?: number;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function buildInvoiceHtml(
  payload: InvoicePayload,
  options: InvoiceVatOptions = {},
): string {
  const vatPercent = Math.min(100, Math.max(0, Number(options.vatPercent || 0)));
  const vatAmount = Math.round(payload.totalAmount * (vatPercent / 100));
  const netAmount = Math.max(0, payload.totalAmount - vatAmount);

  const rowsHtml = payload.items
    .map((item, index) => {
      const productName = escapeHtml(item.name || "Sản phẩm");

      return `
        <tr>
          <td class="c-center">${index + 1}</td>
          <td>${productName}</td>
          <td class="c-right">${item.quantity}</td>
          <td class="c-right">${formatCurrency(item.unitPrice)}</td>
          <td class="c-right">${formatCurrency(item.subtotal)}</td>
        </tr>
      `;
    })
    .join("");

  const notes = escapeHtml(payload.notes || "");
  const customerName = escapeHtml(payload.customerName || "-");
  const customerPhone = escapeHtml(payload.customerPhone || "-");
  const customerAddress = escapeHtml(payload.customerAddress || "-");
  const shopName = escapeHtml(APP_CONFIG.shopName);
  const shopAddress = escapeHtml(APP_CONFIG.shopAddress);
  const shopPhone = escapeHtml(APP_CONFIG.shopPhone);
  const taxCode = escapeHtml(APP_CONFIG.taxCode);
  const shopEmail = escapeHtml(APP_CONFIG.shopEmail);
  const shopWebsite = escapeHtml(APP_CONFIG.shopWebsite);
  const orderCode = escapeHtml(payload.orderId.slice(0, 8).toUpperCase());
  const orderDate = escapeHtml(payload.orderDate);

  return `
    <!doctype html>
    <html>
      <head>
        <meta charset="utf-8" />
        <title>Hóa đơn #${orderCode}</title>
        <style>
          * { box-sizing: border-box; }
          body {
            margin: 0;
            font-family: "Segoe UI", Arial, sans-serif;
            color: #111827;
            padding: 20px;
            background: #f3f4f6;
          }
          .invoice {
            background: #fff;
            max-width: 860px;
            margin: 0 auto;
            border: 1px solid #e5e7eb;
            border-radius: 12px;
            overflow: hidden;
          }
          .header {
            background: linear-gradient(120deg, #1d4ed8, #2563eb);
            color: #fff;
            padding: 20px 24px;
            display: flex;
            justify-content: space-between;
            gap: 12px;
            align-items: flex-end;
          }
          .header h1 {
            margin: 0;
            font-size: 24px;
            line-height: 1.2;
            letter-spacing: .5px;
          }
          .header .meta {
            font-size: 12px;
            text-align: right;
            line-height: 1.5;
          }
          .content {
            padding: 18px 24px 20px;
          }
          .shop, .customer {
            border: 1px solid #e5e7eb;
            border-radius: 10px;
            padding: 12px 14px;
          }
          .section-title {
            margin: 0 0 8px;
            font-size: 13px;
            color: #6b7280;
            text-transform: uppercase;
            letter-spacing: .4px;
          }
          .grid {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 12px;
            margin-bottom: 14px;
          }
          .line {
            margin: 4px 0;
            font-size: 13px;
          }
          table {
            width: 100%;
            border-collapse: collapse;
            margin-top: 12px;
          }
          th, td {
            border: 1px solid #e5e7eb;
            padding: 8px 10px;
            font-size: 13px;
          }
          th {
            background: #f9fafb;
            font-weight: 600;
          }
          .c-right { text-align: right; }
          .c-center { text-align: center; }
          .summary {
            margin-top: 14px;
            margin-left: auto;
            width: 340px;
            border: 1px solid #e5e7eb;
            border-radius: 10px;
            overflow: hidden;
          }
          .summary-row {
            display: flex;
            justify-content: space-between;
            padding: 10px 12px;
            font-size: 13px;
            border-bottom: 1px solid #f3f4f6;
          }
          .summary-row:last-child { border-bottom: none; }
          .summary-total {
            background: #eff6ff;
            color: #1d4ed8;
            font-weight: 700;
            font-size: 16px;
          }
          .notes {
            margin-top: 14px;
            padding: 10px 12px;
            border: 1px dashed #d1d5db;
            border-radius: 8px;
            font-size: 13px;
            background: #fafafa;
          }
          .footer {
            margin-top: 18px;
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 16px;
            font-size: 12px;
            color: #6b7280;
          }
          .sign-box {
            border-top: 1px solid #d1d5db;
            padding-top: 8px;
            text-align: center;
            min-height: 70px;
          }
          @media print {
            body { background: #fff; padding: 0; }
            .invoice { border: 0; border-radius: 0; max-width: none; }
          }
        </style>
      </head>
      <body>
        <div class="invoice">
          <div class="header">
            <div>
              <h1>HÓA ĐƠN BÁN HÀNG</h1>
              <div style="margin-top:6px;font-size:13px;opacity:0.95;">${shopName}</div>
            </div>
            <div class="meta">
              <div>Mã đơn: #${orderCode}</div>
              <div>Ngày: ${orderDate}</div>
            </div>
          </div>

          <div class="content">
            <div class="grid">
              <div class="shop">
                <div class="section-title">Thông tin cửa hàng</div>
                <div class="line"><strong>Địa chỉ:</strong> ${shopAddress}</div>
                <div class="line"><strong>Điện thoại:</strong> ${shopPhone}</div>
                <div class="line"><strong>MST:</strong> ${taxCode}</div>
                <div class="line"><strong>Email:</strong> ${shopEmail}</div>
                <div class="line"><strong>Website:</strong> ${shopWebsite}</div>
              </div>
              <div class="customer">
                <div class="section-title">Thông tin khách hàng</div>
                <div class="line"><strong>Họ tên:</strong> ${customerName}</div>
                <div class="line"><strong>Điện thoại:</strong> ${customerPhone}</div>
                <div class="line"><strong>Địa chỉ:</strong> ${customerAddress}</div>
              </div>
            </div>

            <table>
              <thead>
                <tr>
                  <th style="width:52px;">STT</th>
                  <th>Sản phẩm</th>
                  <th style="width:80px;" class="c-right">SL</th>
                  <th style="width:150px;" class="c-right">Đơn giá</th>
                  <th style="width:170px;" class="c-right">Thành tiền</th>
                </tr>
              </thead>
              <tbody>
                ${rowsHtml}
              </tbody>
            </table>

            <div class="summary">
              <div class="summary-row">
                <span>Tạm tính</span>
                <strong>${formatCurrency(payload.totalAmount)}</strong>
              </div>
              <div class="summary-row">
                <span>Khấu trừ VAT (${vatPercent}%)</span>
                <strong>-${formatCurrency(vatAmount)}</strong>
              </div>
              <div class="summary-row summary-total">
                <span>Thanh toán</span>
                <span>${formatCurrency(netAmount)}</span>
              </div>
            </div>

            ${notes ? `<div class="notes"><strong>Ghi chú:</strong> ${notes}</div>` : ""}

            <div class="footer">
              <div class="sign-box">
                Người bán hàng<br />
                (Ký, ghi rõ họ tên)
              </div>
              <div class="sign-box">
                Khách hàng<br />
                (Ký, ghi rõ họ tên)
              </div>
            </div>
          </div>
        </div>
      </body>
    </html>
  `;
}

export function printInvoiceHtml(html: string): boolean {
  const printFrame = document.createElement("iframe");
  printFrame.style.position = "fixed";
  printFrame.style.right = "0";
  printFrame.style.bottom = "0";
  printFrame.style.width = "0";
  printFrame.style.height = "0";
  printFrame.style.border = "0";
  document.body.appendChild(printFrame);

  const frameDoc =
    printFrame.contentDocument || printFrame.contentWindow?.document;
  if (!frameDoc) {
    document.body.removeChild(printFrame);
    return false;
  }

  frameDoc.open();
  frameDoc.write(html);
  frameDoc.close();

  const cleanup = () => {
    window.setTimeout(() => {
      if (document.body.contains(printFrame)) {
        document.body.removeChild(printFrame);
      }
    }, 300);
  };

  printFrame.onload = () => {
    const frameWindow = printFrame.contentWindow;
    if (!frameWindow) {
      cleanup();
      return;
    }
    frameWindow.focus();
    frameWindow.print();
    cleanup();
  };

  return true;
}
