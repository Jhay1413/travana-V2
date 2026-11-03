import { EMPTY_FILTERS, type QueueChip, type QueueFilters, type QueueScope, type QueueSort } from "./ticket-queue";

export type QueueView = "list" | "board";

export interface QueuePrefs {
  scope: QueueScope;
  view: QueueView;
  chip: QueueChip;
  sort: QueueSort;
  filters: QueueFilters;
  /** Search text, kept for the session so the ticket page walks the same order. */
  search: string;
}

export const DEFAULT_PREFS: QueuePrefs = { scope: "mine", view: "board", chip: "open", sort: "newest", filters: EMPTY_FILTERS, search: "" };

const SCOPES: readonly QueueScope[] = ["mine", "raised", "all"];
const VIEWS: readonly QueueView[] = ["list", "board"];
const CHIPS: readonly QueueChip[] = ["open", "attention", "unassigned", "closed"];
const SORTS: readonly QueueSort[] = ["newest", "due", "priority", "updated", "client"];

function pick<T extends string>(allowed: readonly T[], value: unknown, fallback: T): T {
  return typeof value === "string" && (allowed as readonly string[]).includes(value) ? (value as T) : fallback;
}

function strings(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((v): v is string => typeof v === "string") : [];
}

/** Turns whatever was in storage into valid prefs; "all" falls back to "mine" without an admin role. */
export function sanitizePrefs(raw: unknown, canViewAll: boolean): QueuePrefs {
  if (!raw || typeof raw !== "object") return DEFAULT_PREFS;
  const r = raw as Record<string, unknown>;
  const scope = pick(SCOPES, r.scope, DEFAULT_PREFS.scope);
  const filters = (r.filters && typeof r.filters === "object" ? r.filters : {}) as Record<string, unknown>;
  return {
    scope: scope === "all" && !canViewAll ? "mine" : scope,
    view: pick(VIEWS, r.view, DEFAULT_PREFS.view),
    chip: pick(CHIPS, r.chip, DEFAULT_PREFS.chip),
    sort: pick(SORTS, r.sort, DEFAULT_PREFS.sort),
    filters: { priorities: strings(filters.priorities), kinds: strings(filters.kinds) },
    search: typeof r.search === "string" ? r.search.slice(0, 100) : "",
  };
}
