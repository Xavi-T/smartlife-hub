import type { Product } from "@/types/database";

type ProductPriceState = Pick<Product, "price" | "price_on_request">;

export function isPriceOnRequestProduct(
  product: ProductPriceState | null | undefined,
): boolean {
  if (!product) return false;
  return Boolean(product.price_on_request) || Number(product.price || 0) <= 0;
}
