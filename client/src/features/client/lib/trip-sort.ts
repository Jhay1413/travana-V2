import type { TripStop } from "./trip-types";

export const buildSortKey = (date: string, section: string, time?: string) => `${date || "9999-12-31"}#${section}#${time || "00:00"}`;

/** Plain code-point comparison shared by every itinerary sort, so "-" sorts ahead of the digit sections. */
export const byKey = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);

/**
 * Merges itinerary stops and extras into one date-ordered list. Plain code-point comparison is used
 * so the "-" section (pre-departure extras) sorts ahead of the digit sections. The sort is stable:
 * equal keys keep their input order, and extras without a date (empty sortKey) go last in their
 * original order.
 */
export function mergeTripItems(stops: TripStop[], extras: TripStop[]): TripStop[] {
  const dated = extras.filter((e) => e.sortKey);
  const undated = extras.filter((e) => !e.sortKey);
  const merged = [...stops, ...dated].map((item, order) => ({ item, order }));
  merged.sort((a, b) => byKey(a.item.sortKey, b.item.sortKey) || a.order - b.order);
  return [...merged.map((m) => m.item), ...undated];
}
