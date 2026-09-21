// Single source of truth for client-side deal expiry classification — shared
// by the client page's holidays panel (all-holidays-panel.tsx) and the
// conversations inbox's client-details panel (conversations-inbox.tsx).
//
// This intentionally matches the UI rule (inactive status OR date_expiry in
// the past) rather than the server's date_created + 7d fallback used in
// server/v2/utils/expiry.ts — the two are different notions of "expired" for
// different surfaces and are not meant to be reconciled here.
//
// A third, related helper lives in client/src/features/quote/lib/quote-expiry.ts
// (getQuoteExpiryInfo / isQuotePastExpiry) — it mirrors server/v2/utils/expiry.ts
// instead (with the date_created+7d fallback) and drives the pipeline-aligned
// EXPIRED badge on HolidayDetailView / the standalone quote page. Do not import
// across these two files or rename either isQuoteExpired here to match the other
// — they intentionally answer different questions for different surfaces.

export function startOfToday(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

export const QUOTE_INACTIVE_STATUSES = new Set(["lost", "archived"]);

export const ENQUIRY_INACTIVE_STATUSES = new Set(["lost", "expired", "inactive", "converted", "closed"]);

export function isQuoteExpired(q: { quote_status?: string | null; date_expiry?: string | null }): boolean {
  const statusInactive = !!q.quote_status && QUOTE_INACTIVE_STATUSES.has(q.quote_status.toLowerCase());
  const dateExpired = !!q.date_expiry && new Date(q.date_expiry).getTime() < startOfToday().getTime();
  return statusInactive || dateExpired;
}

export function isEnquiryExpired(e: { status?: string | null; date_expiry?: string | null }): boolean {
  const statusInactive = !!e.status && ENQUIRY_INACTIVE_STATUSES.has(e.status.toLowerCase());
  const dateExpired = !!e.date_expiry && new Date(e.date_expiry).getTime() < startOfToday().getTime();
  return statusInactive || dateExpired;
}

export function isBookingExpired(b: { travel_date?: string | null }): boolean {
  if (!b.travel_date) return false;
  const d = new Date(b.travel_date);
  if (isNaN(d.getTime())) return false;
  return d.getTime() < startOfToday().getTime();
}
