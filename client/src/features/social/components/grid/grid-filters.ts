import type { SocialStatusFilter } from "@/features/quote/api/quote.api";

export type StatusFilter = "all" | SocialStatusFilter;
export type WhenFilter = "all" | "today" | "week" | "month";
export type TagFilter = "any" | "portal" | "featured";

export interface GridFilters {
  status: StatusFilter;
  when: WhenFilter;
  tag: TagFilter;
  q: string;
}

export const STATUS_FILTERS: readonly StatusFilter[] = ["all", "scheduled", "draft", "posted", "not_generated"];
export const WHEN_FILTERS: readonly WhenFilter[] = ["all", "today", "week", "month"];
export const TAG_FILTERS: readonly TagFilter[] = ["any", "portal", "featured"];

export const DEFAULT_GRID_FILTERS: GridFilters = { status: "all", when: "all", tag: "any", q: "" };

function pick<T extends string>(value: string | null, allowed: readonly T[], fallback: T): T {
  return allowed.find((option) => option === value) ?? fallback;
}

/** Reads the grid filters from a location search string ("?status=draft&q=spain"). Unknown values fall back to defaults. */
export function parseGridFilters(search: string): GridFilters {
  const params = new URLSearchParams(search);
  const status = pick(params.get("status"), STATUS_FILTERS, "all");
  return {
    status,

    when: pick(params.get("when"), WHEN_FILTERS, "all"),
    tag: pick(params.get("tag"), TAG_FILTERS, "any"),
    q: (params.get("q") ?? "").trim(),
  };
}

/** Query string (no leading "?") holding only the non-default filters. */
export function serialiseGridFilters(filters: GridFilters): string {
  const params = new URLSearchParams();
  if (filters.status !== "all") params.set("status", filters.status);
  if (filters.when !== "all") params.set("when", filters.when);
  if (filters.tag !== "any") params.set("tag", filters.tag);
  if (filters.q) params.set("q", filters.q);
  return params.toString();
}

export function hasActiveFilters(filters: GridFilters, tagNames: readonly string[]): boolean {
  return filters.status !== "all" || filters.tag !== "any" || filters.q !== "" || tagNames.length > 0;
}

export interface WhenQuery {
  scheduleFilter: string;
  rangeStart: string;
  rangeEnd: string;
}

const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0);
const endOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999);

/**
 * Maps the "when" filter to useFreeQuotesInfinite's schedule params (local day bounds as UTC ISO).
 * today = today; week = today through six days later; month = today through the last day of this month.
 */
export function whenToQuery(when: WhenFilter, now: Date = new Date()): WhenQuery {
  if (when === "all") return { scheduleFilter: "none", rangeStart: "", rangeEnd: "" };
  const start = startOfDay(now);
  let end: Date;
  if (when === "today") end = endOfDay(now);
  else if (when === "week") end = endOfDay(new Date(now.getFullYear(), now.getMonth(), now.getDate() + 6));
  else end = endOfDay(new Date(now.getFullYear(), now.getMonth() + 1, 0));
  return {
    scheduleFilter: when === "today" ? "today" : "none",
    rangeStart: start.toISOString(),
    rangeEnd: end.toISOString(),
  };
}

/** Positional arguments for useFreeQuotesInfinite, derived from the grid filters. */
export type GridQueryArgs = [
  pageSize: number,
  scheduledOnly: boolean,
  scheduleFilter: string,
  search: string,
  rangeStart: string,
  rangeEnd: string,
  unscheduledOnly: boolean,
  showOnPortal: boolean,
  portalStatus: "all",
  tags: string[],
  options: undefined,
  socialStatus: SocialStatusFilter | undefined,
];

/**
 * Maps the grid filters to useFreeQuotesInfinite's arguments. The server only applies the
 * schedule range when `scheduledOnly` is true, so that flag follows the "scheduled" status or any "when" choice.
 */
export function buildGridQueryArgs(
  filters: GridFilters,
  tagNames: string[],
  pageSize = 12,
  now: Date = new Date(),
): GridQueryArgs {
  const scheduled = filters.status === "scheduled" || filters.when !== "all";
  const range = whenToQuery(filters.when, now);
  return [
    pageSize, scheduled, range.scheduleFilter, filters.q, range.rangeStart, range.rangeEnd,
    false, filters.tag === "portal", "all", tagNames, undefined, filters.status === "all" ? undefined : filters.status,
  ];
}

export interface StatusCounts {
  total: number;
  not_generated: number;
  draft: number;
  scheduled: number;
  posted: number;
}

/** "24 posts · 12 scheduled · 4 drafts · 3 posted" */
export function buildCountsLine(counts: StatusCounts | undefined): string {
  if (!counts) return "";
  const posts = `${counts.total} ${counts.total === 1 ? "post" : "posts"}`;
  const drafts = `${counts.draft} ${counts.draft === 1 ? "draft" : "drafts"}`;
  return [posts, `${counts.scheduled} scheduled`, drafts, `${counts.posted} posted`].join(" · ");
}
