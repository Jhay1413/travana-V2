const SHARE_PATTERN = /^\d{1,3}(\.\d{1,2})?$/;

/**
 * Validates a profit-share input. Returns an error message, or null when valid.
 * Accepts 0-100 with at most two decimals; an empty string is rejected.
 * Mirrors the server's profitSharePercentSchema.
 */
export function validateProfitShare(raw: string): string | null {
  const value = raw.trim();
  if (value === "") return "Profit share is required";
  if (!SHARE_PATTERN.test(value)) return "Use a number from 0 to 100 with at most 2 decimals";
  if (Number(value) > 100) return "Profit share cannot exceed 100";
  return null;
}

/** Display form, e.g. "12.50" -> "12.5%", null -> "-". */
export function formatProfitShare(value: string | number | null | undefined): string {
  if (value === null || value === undefined || value === "") return "–";
  const n = Number(value);
  if (!Number.isFinite(n)) return "–";
  return `${Number(n.toFixed(2))}%`;
}

/** Org default (integer percent) as an input string; empty when the org has none. */
export function defaultShareToInput(commission: number | null | undefined): string {
  return typeof commission === "number" && Number.isFinite(commission) ? String(commission) : "";
}
