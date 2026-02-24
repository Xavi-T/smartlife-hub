import type { Product } from "@/types/database";

const GA_MEASUREMENT_ID = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID;
const CURRENCY = "VND";

type GtagParams = Record<string, unknown>;

function canTrack(): boolean {
  return (
    typeof window !== "undefined" &&
    !!GA_MEASUREMENT_ID &&
    typeof (window as any).gtag === "function"
  );
}

export function trackEvent(eventName: string, params?: GtagParams) {
  if (!canTrack()) return;
  (window as any).gtag("event", eventName, params || {});
}

function toGaItem(product: Product, quantity = 1) {
  return {
    item_id: product.id,
    item_name: product.name,
    item_category: product.category,
    price: Number(product.price || 0),
    quantity,
  };
}

export function trackSelectItem(product: Product, listName = "product_list") {
  trackEvent("select_item", {
    item_list_name: listName,
    items: [toGaItem(product, 1)],
  });
}

export function trackViewItem(product: Product) {
  trackEvent("view_item", {
    currency: CURRENCY,
    value: Number(product.price || 0),
    items: [toGaItem(product, 1)],
  });
}

export function trackAddToCart(product: Product, quantity: number) {
  trackEvent("add_to_cart", {
    currency: CURRENCY,
    value: Number(product.price || 0) * quantity,
    items: [toGaItem(product, quantity)],
  });
}

export function trackRemoveFromCart(product: Product, quantity: number) {
  trackEvent("remove_from_cart", {
    currency: CURRENCY,
    value: Number(product.price || 0) * quantity,
    items: [toGaItem(product, quantity)],
  });
}

export function trackBeginCheckout(
  items: Array<{ product: Product; quantity: number }>,
) {
  const gaItems = items.map((item) => toGaItem(item.product, item.quantity));
  const value = gaItems.reduce(
    (sum, item) => sum + Number(item.price || 0) * Number(item.quantity || 0),
    0,
  );

  trackEvent("begin_checkout", {
    currency: CURRENCY,
    value,
    items: gaItems,
  });
}

export function trackPurchase(params: {
  transactionId: string;
  items: Array<{ product: Product; quantity: number }>;
  value: number;
  paymentType?: string;
}) {
  const gaItems = params.items.map((item) =>
    toGaItem(item.product, item.quantity),
  );

  trackEvent("purchase", {
    transaction_id: params.transactionId,
    value: Number(params.value || 0),
    currency: CURRENCY,
    payment_type: params.paymentType,
    items: gaItems,
  });
}
