// Single source of truth for "when does a quote/enquiry expire".
//
// Expiry is derived from `date_expiry`, falling back to `date_created + 7 days`
// when no explicit expiry was set. There is no stored expiry flag — the legacy
// `is_expired` column was removed — so expiry is always derived from the dates
// and the answer can't go stale.

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

type DateInput = Date | string | null | undefined;

/** The effective expiry instant: explicit `date_expiry`, else `date_created + 7d`. */
export function effectiveExpiry(dateExpiry: DateInput, dateCreated: DateInput): Date {
  if (dateExpiry) return new Date(dateExpiry);
  const created = dateCreated ? new Date(dateCreated) : new Date();
  return new Date(created.getTime() + SEVEN_DAYS_MS);
}

/** True when the effective expiry is in the past relative to `now`. */
export function isExpired(dateExpiry: DateInput, dateCreated: DateInput, now: Date = new Date()): boolean {
  return effectiveExpiry(dateExpiry, dateCreated).getTime() < now.getTime();
}
