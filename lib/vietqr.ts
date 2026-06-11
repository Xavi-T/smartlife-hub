export type VietQrTemplate = "compact2" | "compact" | "qr_only";

export interface VietQrInput {
  bankName: string;
  accountNo: string | number;
  amount?: string | number | null;
  addInfo?: string | null;
  accountName?: string | null;
  template?: VietQrTemplate | string | null;
}

export interface VietQrResult {
  status: "success";
  bank_id: string;
  account_no: string;
  qr_url: string;
}

const DEFAULT_TEMPLATE: VietQrTemplate = "compact2";
const VIETQR_BASE_URL = "https://img.vietqr.io/image";

const BANK_ID_ALIASES: Record<string, string> = {
  vietcombank: "vcb",
  vcb: "vcb",
  ngoaithuongvietnam: "vcb",
  techcombank: "tcb",
  tcb: "tcb",
  kythuongvietnam: "tcb",
  mbbank: "mbbank",
  mb: "mbbank",
  mbs: "mbbank",
  quandoi: "mbbank",
  bidv: "bidv",
  daututphattrienvietnam: "bidv",
  vietinbank: "vietinbank",
  vietin: "vietinbank",
  congthuongvietnam: "vietinbank",
  vpbank: "vpbank",
  vpb: "vpbank",
  vietnamthinhvuong: "vpbank",
  agribank: "agribank",
  nongnghiepvaphattriennongthon: "agribank",
  acb: "acb",
  abbank: "abbank",
  bacabank: "bacabank",
  bab: "bacabank",
  hdbank: "hdbank",
  hdb: "hdbank",
  lpbank: "lpbank",
  lienvietpostbank: "lpbank",
  lpb: "lpbank",
  msb: "msb",
  maritimebank: "msb",
  namabank: "namabank",
  nab: "namabank",
  ncb: "ncb",
  ocb: "ocb",
  oceanbank: "oceanbank",
  pgbank: "pgbank",
  pvcombank: "pvcombank",
  sacombank: "sacombank",
  stb: "sacombank",
  saigonbank: "saigonbank",
  scb: "scb",
  seabank: "seabank",
  shb: "shb",
  tpbank: "tpbank",
  tpb: "tpbank",
  vib: "vib",
  vietabank: "vietabank",
  vietbank: "vietbank",
  vccb: "vietcapitalbank",
};

function removeVietnameseMarks(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D");
}

function normalizeBankKey(value: string) {
  return removeVietnameseMarks(value)
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

export function normalizeVietQrBankId(bankName: string) {
  const key = normalizeBankKey(bankName);

  if (!key) {
    throw new Error("Thiếu tên ngân hàng");
  }

  if (BANK_ID_ALIASES[key]) {
    return BANK_ID_ALIASES[key];
  }

  const matchedAlias = Object.entries(BANK_ID_ALIASES).find(([alias]) =>
    key.includes(alias),
  );

  return matchedAlias?.[1] || key;
}

export function cleanVietQrAccountNo(accountNo: string | number) {
  const cleaned = String(accountNo || "").replace(/\D/g, "");

  if (!cleaned) {
    throw new Error("Thiếu số tài khoản nhận tiền");
  }

  return cleaned;
}

export function cleanVietQrAmount(amount?: string | number | null) {
  if (amount === undefined || amount === null || amount === "") {
    return undefined;
  }

  const cleaned = String(amount).replace(/[^\d]/g, "");

  if (!cleaned) {
    return undefined;
  }

  return cleaned;
}

function normalizeTemplate(template?: VietQrInput["template"]) {
  if (template === "compact" || template === "compact2" || template === "qr_only") {
    return template;
  }

  return DEFAULT_TEMPLATE;
}

function appendQueryParam(params: string[], key: string, value?: string | null) {
  const cleaned = String(value || "").trim();
  if (!cleaned) return;
  params.push(`${key}=${encodeURIComponent(cleaned)}`);
}

export function buildVietQrUrl(input: VietQrInput): VietQrResult {
  const bankId = normalizeVietQrBankId(input.bankName);
  const accountNo = cleanVietQrAccountNo(input.accountNo);
  const template = normalizeTemplate(input.template);
  const amount = cleanVietQrAmount(input.amount);
  const baseUrl = `${VIETQR_BASE_URL}/${bankId}-${accountNo}-${template}.png`;
  const params: string[] = [];

  if (amount) {
    params.push(`amount=${amount}`);
  }
  appendQueryParam(params, "addInfo", input.addInfo);
  appendQueryParam(params, "accountName", input.accountName);

  return {
    status: "success",
    bank_id: bankId,
    account_no: accountNo,
    qr_url: params.length > 0 ? `${baseUrl}?${params.join("&")}` : baseUrl,
  };
}
