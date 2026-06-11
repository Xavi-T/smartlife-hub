import { NextRequest, NextResponse } from "next/server";
import { buildVietQrUrl } from "@/lib/vietqr";

type RequestValue = string | number | null | undefined;

function readBodyValue(body: unknown, keys: string[]): RequestValue {
  if (!body || typeof body !== "object") return undefined;
  const record = body as Record<string, unknown>;

  for (const key of keys) {
    const value = record[key];
    if (typeof value === "string" || typeof value === "number") {
      return value;
    }
  }

  return undefined;
}

function getErrorMessage(error: unknown) {
  if (error instanceof Error && error.message) return error.message;
  return "Không thể tạo URL VietQR";
}

function buildFromValues(values: {
  bankName: RequestValue;
  accountNo: RequestValue;
  amount?: RequestValue;
  addInfo?: RequestValue;
  accountName?: RequestValue;
  template?: RequestValue;
}) {
  return buildVietQrUrl({
    bankName: String(values.bankName || ""),
    accountNo: String(values.accountNo || ""),
    amount: values.amount,
    addInfo: values.addInfo ? String(values.addInfo) : null,
    accountName: values.accountName ? String(values.accountName) : null,
    template: values.template ? String(values.template) : null,
  });
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const result = buildFromValues({
      bankName: searchParams.get("bank") || searchParams.get("bankName"),
      accountNo:
        searchParams.get("accountNo") ||
        searchParams.get("account_no") ||
        searchParams.get("accountNumber"),
      amount: searchParams.get("amount"),
      addInfo: searchParams.get("addInfo") || searchParams.get("description"),
      accountName: searchParams.get("accountName"),
      template: searchParams.get("template"),
    });

    return NextResponse.json(result);
  } catch (error: unknown) {
    return NextResponse.json(
      { status: "error", message: getErrorMessage(error) },
      { status: 400 },
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as unknown;
    const result = buildFromValues({
      bankName: readBodyValue(body, ["bank", "bankName"]),
      accountNo: readBodyValue(body, [
        "accountNo",
        "account_no",
        "accountNumber",
      ]),
      amount: readBodyValue(body, ["amount"]),
      addInfo: readBodyValue(body, ["addInfo", "description"]),
      accountName: readBodyValue(body, ["accountName"]),
      template: readBodyValue(body, ["template"]),
    });

    return NextResponse.json(result);
  } catch (error: unknown) {
    return NextResponse.json(
      { status: "error", message: getErrorMessage(error) },
      { status: 400 },
    );
  }
}
