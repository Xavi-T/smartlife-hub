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

export function isDiscountActiveNow(params: {
  discountPercent?: number | null;
  discountStartAt?: string | null;
  discountEndAt?: string | null;
  nowMs?: number;
}): boolean {
  const normalizedDiscount = Math.min(
    100,
    Math.max(0, Number(params.discountPercent ?? 0)),
  );

  if (normalizedDiscount <= 0) return false;

  const now = params.nowMs ?? Date.now();
  const startMs = params.discountStartAt
    ? Date.parse(params.discountStartAt)
    : NaN;
  const endMs = params.discountEndAt ? Date.parse(params.discountEndAt) : NaN;

  if (Number.isFinite(startMs) && now < startMs) return false;
  if (Number.isFinite(endMs) && now > endMs) return false;

  return true;
}

export function getEffectiveDiscountPercent(params: {
  discountPercent?: number | null;
  discountStartAt?: string | null;
  discountEndAt?: string | null;
  nowMs?: number;
}): number {
  if (!isDiscountActiveNow(params)) return 0;
  return Math.min(100, Math.max(0, Number(params.discountPercent ?? 0)));
}

export function formatRemainingTime(remainingMs: number): string {
  const totalSeconds = Math.max(0, Math.floor(remainingMs / 1000));

  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (days > 0) {
    return `${days} ngày ${hours} giờ ${minutes} phút ${seconds} giây`;
  }

  return `${hours.toString().padStart(2, "0")}:${minutes
    .toString()
    .padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;
}
