import type { SocialStatusFilter } from "@/features/quote/api/quote.api";
import type { SocialPostStatus } from "@/features/social/lib/post-status";

/** "draft" covers both server statuses draft and not_generated (the server filters one at a time). */
export type StatusFilter = "all" | Exclude<SocialStatusFilter, "not_generated">;
export type WhenFilter = "all" | "today" | "week" | "month" | "custom";
export type TagFilter = "any" | "portal" | "featured";

export interface GridFilters {
  status: StatusFilter;
  when: WhenFilter;
  /** Custom range bounds (yyyy-mm-dd), used only when `when` is "custom". */
  from: string;
  to: string;
  tag: TagFilter;
  q: string;
}

export const STATUS_FILTERS: readonly StatusFilter[] = ["all", "scheduled", "draft", "posted"];
export const WHEN_FILTERS: readonly WhenFilter[] = ["all", "today", "week", "month", "custom"];
export const TAG_FILTERS: readonly TagFilter[] = ["any", "portal", "featured"];

export const DEFAULT_GRID_FILTERS: GridFilters = { status: "all", when: "all", from: "", to: "", tag: "any", q: "" };

function pick<T extends string>(value: string | null, allowed: readonly T[], fallback: T): T {
  return allowed.find((option) => option === value) ?? fallback;
}

const ISO_DAY = /^(\d{4})-(\d{2})-(\d{2})$/;

function parseIsoDay(value: string): Date | null {
  const m = ISO_DAY.exec(value);
  if (!m) return null;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return d.getMonth() === Number(m[2]) - 1 && d.getDate() === Number(m[3]) ? d : null;
}

/** A custom range counts only when both ends are real dates and from is not after to. */
export function isValidDateRange(from: string, to: string): boolean {
  const start = parseIsoDay(from);
  const end = parseIsoDay(to);
  return !!start && !!end && start.getTime() <= end.getTime();
}

/** Whether the "when" filter currently narrows the query (a custom range with a bad range does not). */
export function isWhenActive(filters: Pick<GridFilters, "when" | "from" | "to">): boolean {
  if (filters.when === "all") return false;
  return filters.when !== "custom" || isValidDateRange(filters.from, filters.to);
}

/** Reads the grid filters from a location search string ("?status=draft&q=spain"). Unknown values fall back to defaults. */
export function parseGridFilters(search: string): GridFilters {
  const params = new URLSearchParams(search);
  const raw = params.get("status");
  // Old links to the Not generated chip land on Drafts, which now includes them.
  const status = pick(raw === "not_generated" ? "draft" : raw, STATUS_FILTERS, "all");
  return {
    status,
    when: pick(params.get("when"), WHEN_FILTERS, "all"),
    from: parseIsoDay(params.get("from") ?? "") ? (params.get("from") ?? "") : "",
    to: parseIsoDay(params.get("to") ?? "") ? (params.get("to") ?? "") : "",
    tag: pick(params.get("tag"), TAG_FILTERS, "any"),
    q: (params.get("q") ?? "").trim(),
  };
}

/** Query string (no leading "?") holding only the non-default filters. */
export function serialiseGridFilters(filters: GridFilters): string {
  const params = new URLSearchParams();
  if (filters.status !== "all") params.set("status", filters.status);
  if (filters.when !== "all") params.set("when", filters.when);
  if (filters.when === "custom") {
    if (filters.from) params.set("from", filters.from);
    if (filters.to) params.set("to", filters.to);
  }
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
export function whenToQuery(when: WhenFilter, now: Date = new Date(), custom: { from: string; to: string } = { from: "", to: "" }): WhenQuery {
  if (when === "all") return { scheduleFilter: "none", rangeStart: "", rangeEnd: "" };
  if (when === "custom") {
    const from = parseIsoDay(custom.from);
    const to = parseIsoDay(custom.to);
    if (!from || !to || !isValidDateRange(custom.from, custom.to)) return { scheduleFilter: "none", rangeStart: "", rangeEnd: "" };
    return { scheduleFilter: "none", rangeStart: startOfDay(from).toISOString(), rangeEnd: endOfDay(to).toISOString() };
  }
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
  const scheduled = filters.status === "scheduled" || isWhenActive(filters);
  const range = whenToQuery(filters.when, now, filters);
  return [
    pageSize, scheduled, range.scheduleFilter, filters.q, range.rangeStart, range.rangeEnd,
    false, filters.tag === "portal", "all", tagNames, undefined, serverSocialStatus(filters.status),
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
  const draftTotal = counts.draft + counts.not_generated;
  const drafts = `${draftTotal} ${draftTotal === 1 ? "draft" : "drafts"}`;
  return [posts, `${counts.scheduled} scheduled`, drafts, `${counts.posted} posted`].join(" · ");
}

/** Status sent to the server. Drafts cannot be sent (they span two server statuses), so they load unfiltered and are narrowed on the client. */
export function serverSocialStatus(filter: StatusFilter): SocialStatusFilter | undefined {
  return filter === "all" || filter === "draft" ? undefined : filter;
}

/** Whether a post with this derived status belongs under the chosen chip. Drafts include not-generated posts. */
export function matchesStatusFilter(status: SocialPostStatus, filter: StatusFilter): boolean {
  if (filter === "all") return true;
  if (filter === "draft") return status === "draft" || status === "not_generated";
  return status === filter;
}

/** Count shown on a chip; Drafts adds the not-generated posts. */
export function statusChipCount(filter: StatusFilter, counts: StatusCounts): number {
  if (filter === "all") return counts.total;
  if (filter === "draft") return counts.draft + counts.not_generated;
  return counts[filter];
}
