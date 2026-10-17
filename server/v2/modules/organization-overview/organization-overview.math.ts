import type { LeadSourceKey } from "./organization-overview.types";

/** Profit per booking; 0 when there are no bookings. */
export function perBooking(profit: number, bookings: number): number {
  return bookings > 0 ? profit / bookings : 0;
}

/**
 * Bookings created in a window over deals quoted in the same window (not a
 * cohort), so a busy day can exceed 100% - clamp it. 0 when nothing was quoted.
 */
export function closeRatePercent(bookings: number, quotedDeals: number): number {
  return quotedDeals > 0 ? Math.min(100, (bookings / quotedDeals) * 100) : 0;
}

const LEAD_SOURCE_LABELS: Record<LeadSourceKey, string> = {
  SHOP: "Shop",
  FACEBOOK: "Facebook",
  WHATSAPP: "WhatsApp",
  INSTAGRAM: "Instagram",
  PHONE_ENQUIRY: "Phone enquiry",
  none: "Not recorded",
};

function isKnownLeadSource(value: string): value is LeadSourceKey {
  return Object.prototype.hasOwnProperty.call(LEAD_SOURCE_LABELS, value);
}

/** Display label for a lead source key; unknown values are title-cased. */
export function leadSourceLabel(key: string): string {
  if (isKnownLeadSource(key)) return LEAD_SOURCE_LABELS[key];
  const words = key.replace(/[_-]+/g, " ").trim().toLowerCase().split(/\s+/).filter(Boolean);
  if (words.length === 0) return LEAD_SOURCE_LABELS.none;
  return words.map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");
}

