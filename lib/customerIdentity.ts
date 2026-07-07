export const GUEST_CUSTOMER_NAME = "Khách lẻ";
const GUEST_PHONE_PREFIX = "000";

export function normalizePhone(value: unknown): string {
  return String(value || "").replace(/\D/g, "");
}

export function isGuestPhone(value: unknown): boolean {
  const phone = normalizePhone(value);
  if (!phone) return true;

  return (
    phone.length >= 10 &&
    (/^0+$/.test(phone) || phone.startsWith(GUEST_PHONE_PREFIX))
  );
}

export function createGuestCustomerPhone(): string {
  const timestamp = Date.now().toString();
  const random = Math.floor(Math.random() * 1000)
    .toString()
    .padStart(3, "0");

  return `${GUEST_PHONE_PREFIX}${timestamp}${random}`.slice(0, 20);
}

export function getDisplayCustomerPhone(value: unknown): string {
  return isGuestPhone(value) ? "" : String(value || "").trim();
}

export function isGuestCustomerName(value: unknown): boolean {
  const name = String(value || "").trim().toLocaleLowerCase("vi");
  return !name || name === GUEST_CUSTOMER_NAME.toLocaleLowerCase("vi");
}

export function getDisplayCustomerName(params: {
  name?: unknown;
  phone?: unknown;
}): string {
  const name = String(params.name || "").trim();
  return name || GUEST_CUSTOMER_NAME;
}
