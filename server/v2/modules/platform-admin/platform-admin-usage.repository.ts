// All AI + SendSeven usage tables (`org_usage_limits`, `ai_usage_*`,
// `sendseven_message_usage`, `model_pricing`) are owned by `../usage`
// (see `usage.repository.ts`) — this module never queries them directly.
// This file exists (mirroring `startOfMonthUtc` living in
// `platform-admin-credits.repository.ts`) for pure period-math helpers
// co-located with the platform-admin usage feature.

/**
 * First-of-month date in UTC as a `YYYY-MM-DD` string, `monthsBack` months
 * before `now`'s calendar month (1 = the current month only, i.e. the same
 * value as `startOfMonthUtc()`).
 */
export function periodStartMonthsAgo(monthsBack: number, now: Date = new Date()): string {
  const anchor = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - (monthsBack - 1), 1));
  const y = anchor.getUTCFullYear();
  const m = String(anchor.getUTCMonth() + 1).padStart(2, '0');
  return `${y}-${m}-01`;
}
