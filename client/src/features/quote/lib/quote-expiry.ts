// Single definition of "is this quote expired / expiring soon" for the
// client. Mirrors server/v2/utils/expiry.ts's effectiveExpiry/isExpired
// exactly — that's the canonical definition already relied on by the
// pipeline's SQL queries and the agent dashboard's "Expiring Quotes" widget
// (see transaction.service.ts's getExpiringQuotes / transaction.repository.ts's
// findExpiringQuotes). Reused by the standalone quote page, the "Update
// Expiry" dialog's default date, and HolidayDetailView.
//
// NB: this is deliberately a DIFFERENT notion of "expired" than
// client/src/lib/deal-expiry.ts, which drives the All Holidays list and the
// conversations inbox panel (status-based, no date_created+7d fallback, and
// compares against local start-of-day rather than an instant). That
// divergence is documented and intentional in deal-expiry.ts itself — the two
// helpers are for different surfaces and are not meant to share a name or an
// implementation. See deal-expiry.ts's file header for the reasoning.

export type QuoteExpiryStatus = "expired" | "expiring-soon" | "active";

export interface QuoteExpiryInfo {
  status: QuoteExpiryStatus;
  /** Days until the effective expiry (negative once past). Null only for the
   *  "expired via the no-expiry-set fallback" case, where a day count isn't
   *  meaningful to surface. */
  diffDays: number | null;
}

const MS_PER_DAY = 1000 * 60 * 60 * 24;
// Matches findExpiringQuotes' surfacing window (transaction.repository.ts) —
// a quote due to expire within this many days is flagged "expiring soon".
export const NEAR_EXPIRY_WINDOW_DAYS = 7;
// There's no org-level "default quote validity" setting. This is both the
// fallback effectiveExpiry uses for a quote with no date_expiry, and the
// server's own bumpStaleExpirySql default (transaction.repository.ts) — the
// closest thing to an established default in the app today.
export const DEFAULT_EXPIRY_EXTENSION_DAYS = 7;

/** The effective expiry instant: explicit date_expiry, else date_created + 7
 *  days. Mirrors server/v2/utils/expiry.ts's effectiveExpiry exactly. */
export function effectiveExpiry(
  dateExpiry: string | Date | null | undefined,
  dateCreated: string | Date | null | undefined,
  now: Date = new Date(),
): Date {
  if (dateExpiry) return new Date(dateExpiry);
  const created = dateCreated ? new Date(dateCreated) : now;
  return new Date(created.getTime() + DEFAULT_EXPIRY_EXTENSION_DAYS * MS_PER_DAY);
}

/** True once the effective expiry is in the past. Mirrors
 *  server/v2/utils/expiry.ts's isExpired exactly. Named to avoid colliding
 *  with client/src/lib/deal-expiry.ts's differently-defined isQuoteExpired —
 *  the two are not interchangeable (see file header). */
export function isQuotePastExpiry(
  dateExpiry: string | Date | null | undefined,
  dateCreated: string | Date | null | undefined,
  now: Date = new Date(),
): boolean {
  return effectiveExpiry(dateExpiry, dateCreated, now).getTime() < now.getTime();
}

/** Returns the quote's expiry status, or null when there's nothing worth
 *  flagging yet — a quote with no date_expiry set is kept quiet until it
 *  actually reaches the date_created + 7 day fallback (no forward-looking
 *  "expiring soon" warning without an explicit date to count down from). */
export function getQuoteExpiryInfo(
  dateExpiry: string | Date | null | undefined,
  dateCreated: string | Date | null | undefined,
  now: Date = new Date(),
): QuoteExpiryInfo | null {
  if (!dateExpiry) {
    if (!isQuotePastExpiry(dateExpiry, dateCreated, now)) return null;
    return { status: "expired", diffDays: null };
  }

  const diffDays = Math.ceil((new Date(dateExpiry).getTime() - now.getTime()) / MS_PER_DAY);
  if (diffDays < 0) return { status: "expired", diffDays };
  if (diffDays <= NEAR_EXPIRY_WINDOW_DAYS) return { status: "expiring-soon", diffDays };
  return { status: "active", diffDays };
}

// yyyy-mm-dd using LOCAL calendar fields — NOT toISOString(), which reports
// the UTC calendar date and can be a day off from what the user sees on
// screen (e.g. late evening in a positive-UTC-offset timezone, or early
// morning in a negative-offset one). DatePicker's own startOfToday()
// (components/ui/date-picker.tsx) is local-based, so this has to match it.
function toIsoDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** "Today" as a yyyy-mm-dd LOCAL string, for DatePicker's `min` prop. */
export function todayIsoDate(now: Date = new Date()): string {
  return toIsoDate(now);
}

/** Converts a stored date_expiry instant back into a yyyy-mm-dd LOCAL string
 *  for the DatePicker input — pairs with endOfDayIso() below so a date picked
 *  by the user round-trips to the same calendar day after being saved and
 *  read back. */
export function toDateInputValue(dateExpiry: string | Date | null | undefined): string {
  if (!dateExpiry) return "";
  const d = new Date(dateExpiry);
  if (isNaN(d.getTime())) return "";
  return toIsoDate(d);
}

/** Converts a yyyy-mm-dd date-only string into an end-of-LOCAL-day ISO
 *  instant. date_expiry is a timestamptz compared as a strict instant (see
 *  isQuotePastExpiry / server/v2/utils/expiry.ts's isExpired) — writing
 *  UTC midnight for "today" would read as already-expired for most of the
 *  day in any positive-UTC-offset timezone (e.g. UK on BST), and
 *  `min={todayIsoDate()}` makes "today" a one-click selection. The
 *  `T23:59:59` suffix (no timezone designator) is parsed as local time per
 *  the Date constructor's spec, which is what we want here. */
export function endOfDayIso(isoDate: string): string {
  return new Date(`${isoDate}T23:59:59`).toISOString();
}

/** Default date to preselect when opening the "Update Expiry" dialog: the
 *  quote's current expiry when it's still valid, otherwise today +
 *  DEFAULT_EXPIRY_EXTENSION_DAYS (covers both "no expiry set" and "already
 *  expired"). */
export function suggestNextExpiryDate(currentIsoDate: string, now: Date = new Date()): string {
  const today = todayIsoDate(now);
  if (currentIsoDate && currentIsoDate >= today) return currentIsoDate;
  const suggested = new Date(now);
  suggested.setDate(suggested.getDate() + DEFAULT_EXPIRY_EXTENSION_DAYS);
  return toIsoDate(suggested);
}
