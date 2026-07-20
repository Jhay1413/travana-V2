// Shared formatting helpers for AI + SendSeven usage UI — used by both the
// platform-admin usage views (cross-org profit analysis) and the org-facing
// usage page (org admins viewing their own organization's usage).

/** Integer micros (1,000,000 = $1) → a dollar string with 2-4 decimals. */
export function formatMicrosAsUsd(micros: number): string {
  const dollars = micros / 1_000_000;
  // Sub-cent amounts are common at low volume — show up to 4 decimals, but
  // never fewer than 2, so the value stays legible either way.
  const decimals = Math.abs(dollars) > 0 && Math.abs(dollars) < 0.01 ? 4 : 2;
  return `$${dollars.toLocaleString("en-US", { minimumFractionDigits: decimals, maximumFractionDigits: decimals })}`;
}

/** Token/message counts with thousands separators. */
export function formatCount(n: number): string {
  return Math.round(n).toLocaleString("en-US");
}

/** Percentage used out of a (possibly unlimited) limit, clamped to [0, 999]. */
export function usagePct(used: number, limit: number | null): number {
  if (limit === null || limit <= 0) return 0;
  return Math.min(999, Math.round((used / limit) * 100));
}
