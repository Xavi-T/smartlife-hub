import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("vi-VN", {
    style: "currency",
    currency: "VND",
  }).format(amount);
}

export function formatNumber(num: number): string {
  return new Intl.NumberFormat("vi-VN").format(num);
}

export function calculateDiscountedPrice(
  price: number,
  discountPercent?: number | null,
): number {
  const normalizedDiscount = Math.min(
    100,
    Math.max(0, Number(discountPercent ?? 0)),
  );

  if (normalizedDiscount <= 0) return price;

  const discounted = price * (1 - normalizedDiscount / 100);
  return Math.round(discounted);
}
