import { NextRequest, NextResponse } from "next/server";
import { isAdminAuthFailure, requireAdminRole } from "@/lib/adminAuth";
import { createServiceRoleSupabaseClient } from "@/lib/supabase-admin";

interface ProductRow {
  id: string;
  name: string;
}

interface ProfileRow {
  product_id: string;
  tax_group_name: string | null;
  business_activity: string | null;
  vat_rate_percent: number | null;
  pit_rate_percent: number | null;
  notes: string | null;
}

function isMissingSchema(error: { code?: string; message?: string }) {
  return (
    error.code === "42P01" ||
    error.code === "PGRST205" ||
    error.message?.includes("product_tax_profiles")
  );
}

function schemaErrorResponse() {
  return NextResponse.json(
    {
      error:
        "Chưa cài đặt hồ sơ thuế sản phẩm. Hãy chạy database/tax_readiness_schema.sql trên Supabase.",
    },
    { status: 503 },
  );
}

function normalizeRate(value: unknown) {
  if (value === null || value === undefined || value === "") return null;
  const rate = Number(value);
  return Number.isFinite(rate) && rate >= 0 && rate <= 100
    ? rate
    : undefined;
}

export async function GET(request: NextRequest) {
  try {
    const auth = await requireAdminRole();
    if (isAdminAuthFailure(auth)) return auth.response;

    const supabase = createServiceRoleSupabaseClient();
    if (!supabase) {
      return NextResponse.json(
        { error: "Thiếu cấu hình SUPABASE_SERVICE_ROLE_KEY" },
        { status: 500 },
      );
    }

    const params = new URL(request.url).searchParams;
    const page = Math.max(1, Number(params.get("page")) || 1);
    const pageSize = Math.min(
      100,
      Math.max(1, Number(params.get("pageSize")) || 20),
    );
    const search = String(params.get("search") || "").trim().slice(0, 100);

    let productQuery = supabase
      .from("products")
      .select("id, name", { count: "exact" });
    if (search) productQuery = productQuery.ilike("name", `%${search}%`);

    const fromIndex = (page - 1) * pageSize;
    const {
      data: productData,
      count,
      error: productError,
    } = await productQuery
      .order("name", { ascending: true })
      .range(fromIndex, fromIndex + pageSize - 1);

    if (productError) throw productError;
    const products = (productData || []) as ProductRow[];
    const productIds = products.map((product) => product.id);

    let profiles: ProfileRow[] = [];
    if (productIds.length) {
      const { data, error } = await supabase
        .from("product_tax_profiles")
        .select(
          "product_id, tax_group_name, business_activity, vat_rate_percent, pit_rate_percent, notes",
        )
        .in("product_id", productIds);

      if (error) {
        if (isMissingSchema(error)) return schemaErrorResponse();
        throw error;
      }
      profiles = (data || []) as ProfileRow[];
    }

    const profileMap = new Map(
      profiles.map((profile) => [profile.product_id, profile]),
    );
    return NextResponse.json(
      {
        profiles: products.map((product) => {
          const profile = profileMap.get(product.id);
          const taxGroupName = profile?.tax_group_name || "";
          const businessActivity = profile?.business_activity || "";
          const vatRatePercent =
            profile?.vat_rate_percent === null ||
            profile?.vat_rate_percent === undefined
              ? null
              : Number(profile.vat_rate_percent);
          const pitRatePercent =
            profile?.pit_rate_percent === null ||
            profile?.pit_rate_percent === undefined
              ? null
              : Number(profile.pit_rate_percent);

          return {
            productId: product.id,
            productName: product.name,
            sku: product.id.slice(0, 8).toUpperCase(),
            taxGroupName,
            businessActivity,
            vatRatePercent,
            pitRatePercent,
            notes: profile?.notes || "",
            isConfigured: Boolean(
              taxGroupName ||
                businessActivity ||
                vatRatePercent !== null ||
                pitRatePercent !== null,
            ),
          };
        }),
        pagination: { page, pageSize, total: count || 0 },
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    console.error("Error loading product tax profiles:", error);
    return NextResponse.json(
      { error: "Không thể tải hồ sơ thuế sản phẩm" },
      { status: 500 },
    );
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const auth = await requireAdminRole();
    if (isAdminAuthFailure(auth)) return auth.response;

    const body = await request.json();
    const productId = String(body.productId || "");
    const vatRatePercent = normalizeRate(body.vatRatePercent);
    const pitRatePercent = normalizeRate(body.pitRatePercent);

    if (!productId) {
      return NextResponse.json(
        { error: "Thiếu mã sản phẩm" },
        { status: 400 },
      );
    }
    if (vatRatePercent === undefined || pitRatePercent === undefined) {
      return NextResponse.json(
        { error: "Thuế suất phải nằm trong khoảng 0–100%" },
        { status: 400 },
      );
    }

    const supabase = createServiceRoleSupabaseClient();
    if (!supabase) {
      return NextResponse.json(
        { error: "Thiếu cấu hình SUPABASE_SERVICE_ROLE_KEY" },
        { status: 500 },
      );
    }

    const { error } = await supabase.from("product_tax_profiles").upsert(
      {
        product_id: productId,
        tax_group_name: String(body.taxGroupName || "").trim() || null,
        business_activity:
          String(body.businessActivity || "").trim() || null,
        vat_rate_percent: vatRatePercent,
        pit_rate_percent: pitRatePercent,
        notes: String(body.notes || "").trim() || null,
        updated_by: auth.user.email || auth.user.id,
      },
      { onConflict: "product_id" },
    );

    if (error) {
      if (isMissingSchema(error)) return schemaErrorResponse();
      throw error;
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error updating product tax profile:", error);
    return NextResponse.json(
      { error: "Không thể cập nhật hồ sơ thuế sản phẩm" },
      { status: 500 },
    );
  }
}
