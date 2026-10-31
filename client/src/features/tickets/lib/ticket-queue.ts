import { sortPinnedFirst } from "@/lib/sort-pinned-first";
import { cleanClientName, shortId } from "./ticket-display";
import { deriveDuePill, dueSortKey, type DuePillModel } from "./ticket-due";
import { isActiveTicket, isMyTicket } from "./ticket-filters";
import type { Ticket, TicketListScope } from "../types";

// Pure queue logic: scope -> counts -> chip -> filters/search -> sort -> groups.
// Everything runs client-side over the loaded list.

export type QueueScope = TicketListScope;
export type QueueChip = "open" | "attention" | "unassigned" | "closed";
export type QueueSort = "newest" | "due" | "priority" | "updated" | "client";

export interface QueueFilters {
  priorities: string[];
  kinds: string[];
}

export const EMPTY_FILTERS: QueueFilters = { priorities: [], kinds: [] };

export interface QueueCounts {
  open: number;
  attention: number;
  unassigned: number;
  closed: number;
}

export interface QueueGroup {
  key: string;
  label: string;
  hint: string;
  rows: Ticket[];
}

export interface QueueResult {
  /** Each row's due pill, derived once per pass. */
  pills: ReadonlyMap<string, DuePillModel>;
  groups: QueueGroup[];
  rows: Ticket[];
  orderIds: string[];
  counts: QueueCounts;
}

/** Whether a row is active and overdue / due soon, from a pill that was already derived. */
export type NeedsAttention = (t: Ticket) => boolean;

export function makeNeedsAttention(now: Date, pills?: ReadonlyMap<string, DuePillModel>): NeedsAttention {
  return (t) => {
    const { tone } = pills?.get(t.id) ?? deriveDuePill(t, now);
    return tone === "over" || tone === "soon";
  };
}

const PRIORITY_RANK: Record<string, number> = { Urgent: 0, High: 1, Medium: 2, Low: 3 };

/** "mine" keeps the same rows the sidebar badge counts; the other scopes are server-side slices. */
export function scopeRows(rows: Ticket[], scope: QueueScope, userId: string | undefined): Ticket[] {
  return scope === "mine" ? rows.filter((t) => isMyTicket(t, userId)) : rows;
}

export function chipCounts(rows: Ticket[], now: Date, needs: NeedsAttention = makeNeedsAttention(now)): QueueCounts {
  const counts: QueueCounts = { open: 0, attention: 0, unassigned: 0, closed: 0 };
  for (const t of rows) {
    if (!isActiveTicket(t)) {
      counts.closed++;
      continue;
    }
    counts.open++;
    if (needs(t)) counts.attention++;
    if (!t.assignedTo) counts.unassigned++;
  }
  return counts;
}

export function applyChip(rows: Ticket[], chip: QueueChip, now: Date, needs: NeedsAttention = makeNeedsAttention(now)): Ticket[] {
  switch (chip) {
    case "open":
      return rows.filter(isActiveTicket);
    case "attention":
      return rows.filter((t) => isActiveTicket(t) && needs(t));
    case "unassigned":
      return rows.filter((t) => isActiveTicket(t) && !t.assignedTo);
    case "closed":
      return rows.filter((t) => !isActiveTicket(t));
  }
}

export function applyFilters(rows: Ticket[], filters: QueueFilters): Ticket[] {
  return rows.filter(
    (t) =>
      (filters.priorities.length === 0 || filters.priorities.includes(t.priority)) &&
      (filters.kinds.length === 0 || filters.kinds.includes(t.type)),
  );
}

export function activeFilterCount(filters: QueueFilters): number {
  return filters.priorities.length + filters.kinds.length;
}

export function matchesSearch(t: Ticket, query: string): boolean {
  const q = query.trim().replace(/^#/, "").toLowerCase();
  if (!q) return true;
  const haystack = [
    t.subject,
    cleanClientName(t.clientName),
    t.id,
    shortId(t.id),
    t.assignedToName,
    t.clientPhone,
    t.holiday?.title,
    t.holiday?.haysRef,
    t.holiday?.supplierRef,
    t.holiday?.operatorName,
  ];
  return haystack.some((value) => !!value && value.toLowerCase().includes(q));
}

function activityKey(t: Ticket): number {
  const at = Date.parse(t.lastActivityAt ?? t.updatedAt ?? t.createdAt);
  return Number.isNaN(at) ? 0 : at;
}

/** Newest first: active tickets by when they were raised; Resolved / Closed by when they were resolved (else last activity). */
function newestKey(t: Ticket): number {
  if (isActiveTicket(t)) {
    const at = Date.parse(t.createdAt);
    return Number.isNaN(at) ? 0 : at;
  }
  const resolved = t.resolvedAt ? Date.parse(t.resolvedAt) : NaN;
  return Number.isNaN(resolved) ? activityKey(t) : resolved;
}

export function sortRows(rows: Ticket[], sort: QueueSort): Ticket[] {
  const out = [...rows];
  switch (sort) {
    case "newest":
      return out.sort((a, b) => newestKey(b) - newestKey(a));
    case "due":
      // Infinity - Infinity is NaN, so compare explicitly to keep no-due rows last and stable.
      return out.sort((a, b) => {
        const ka = dueSortKey(a);
        const kb = dueSortKey(b);
        return ka === kb ? 0 : ka < kb ? -1 : 1;
      });
    case "priority":
      return out.sort(
        (a, b) => (PRIORITY_RANK[a.priority] ?? 9) - (PRIORITY_RANK[b.priority] ?? 9) || activityKey(b) - activityKey(a),
      );
    case "updated":
      return out.sort((a, b) => activityKey(b) - activityKey(a));
    case "client":
      return out.sort((a, b) => {
        const na = cleanClientName(a.clientName);
        const nb = cleanClientName(b.clientName);
        if (na === nb) return 0;
        if (na === null) return 1;
        if (nb === null) return -1;
        return na.localeCompare(nb);
      });
  }
}

const CHIP_LABEL: Record<QueueChip, string> = {
  open: "Open",
  attention: "Needs attention",
  unassigned: "Unassigned",
  closed: "Resolved and closed",
};

/** The open chip splits into "Needs attention" / "Open"; the others are one group. Pinned first within each. */
export function groupRows(
  rows: Ticket[],
  chip: QueueChip,
  pinned: ReadonlyMap<string, number>,
  now: Date,
  needs: NeedsAttention = makeNeedsAttention(now),
): QueueGroup[] {
  if (chip === "open") {
    const urgent = rows.filter(needs);
    const rest = rows.filter((t) => !needs(t));
    return [
      { key: "attention", label: "Needs attention", hint: "Overdue or due within 2 hours", rows: sortPinnedFirst(urgent, pinned) },
      { key: "open", label: "Open", hint: "", rows: sortPinnedFirst(rest, pinned) },
    ];
  }
  return [{ key: chip, label: CHIP_LABEL[chip], hint: "", rows: sortPinnedFirst(rows, pinned) }];
}

export interface DeriveQueueInput {
  rows: Ticket[];
  scope: QueueScope;
  userId: string | undefined;
  chip: QueueChip;
  search: string;
  filters: QueueFilters;
  sort: QueueSort;
  pinned: ReadonlyMap<string, number>;
  now: Date;
  /** Board view: the default open chip also shows Resolved / Closed so every column can fill. */
  includeClosed?: boolean;
}

export function deriveQueue(input: DeriveQueueInput): QueueResult {
  const { rows, scope, userId, chip, search, filters, sort, pinned, now, includeClosed } = input;
  const scoped = scopeRows(rows, scope, userId);
  const pills = new Map<string, DuePillModel>(scoped.map((t) => [t.id, deriveDuePill(t, now)]));
  const needs = makeNeedsAttention(now, pills);
  const counts = chipCounts(scoped, now, needs);
  const shown = sortRows(
    applyFilters(includeClosed && chip === "open" ? scoped : applyChip(scoped, chip, now, needs), filters).filter((t) => matchesSearch(t, search)),
    sort,
  );
  const groups = groupRows(shown, chip, pinned, now, needs);
  const ordered = groups.flatMap((g) => g.rows);
  return { pills, groups, rows: ordered, orderIds: ordered.map((t) => t.id), counts };
}
