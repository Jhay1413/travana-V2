import type { SeatUsage } from "@/features/organization/api/organization.api";

/** Bar width in percent (2..100 so an empty bar still shows). Unlimited plans show the minimum. */
export function seatPercent(used: number, limit: number | null): number {
  if (!limit || limit <= 0) return 2;
  return Math.min(100, Math.max(2, Math.round((used / limit) * 100)));
}

/** "12 / 25" or just "12" when the plan has no limit. */
export function seatsLabel(used: number, limit: number | null): string {
  return limit === null ? String(used) : `${used} / ${limit}`;
}

/** Seats left, or null for unlimited. Never negative. */
export function seatsFree(usage: Pick<SeatUsage, "limit" | "used">): number | null {
  return usage.limit === null ? null : Math.max(0, usage.limit - usage.used);
}

export function seatsAfter(used: number, adding: number): number {
  return used + Math.max(0, adding);
}

/** How many of the new invites do not fit. 0 when unlimited or everything fits. */
export function seatsOver(used: number, adding: number, limit: number | null): number {
  if (limit === null) return 0;
  return Math.max(0, used + Math.max(0, adding) - limit);
}

export function seatsFull(usage: Pick<SeatUsage, "limit" | "used">): boolean {
  return usage.limit !== null && usage.used >= usage.limit;
}

export function pendingNote(pending: number): string | null {
  if (pending <= 0) return null;
  return `incl. ${pending} pending ${pending === 1 ? "invite" : "invites"}`;
}
