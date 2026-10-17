import type { Conversation, InboxTab } from "../../../types";
import {
  applySort,
  isDoneSnooze,
  matchesFilters,
  type InboxFilters,
  type QuickChip,
  type SortPreference,
} from "../lib";

export type InboxListTab = "open" | "snoozed" | "done";

/** The list tab → the server's status query (Done is the old "closed" tab). */
export function tabToQuery(tab: InboxListTab): InboxTab {
  return tab === "done" ? "closed" : tab;
}

/** Done = closed OR parked by a year-long snooze (how "close" is modelled). */
export function isDone(c: Conversation, now: Date): boolean {
  return c.status === "closed" || isDoneSnooze(c.snoozedUntil, now);
}

/**
 * Mirrors the server's tab filter so optimistic local changes (close/snooze)
 * move a row out of the list immediately.
 */
export function matchesTab(c: Conversation, tab: InboxListTab, now: Date): boolean {
  switch (tab) {
    case "snoozed":
      // The server's snoozed list also holds snoozes that have already lapsed
      // (the provider never clears `snoozed_until`), so trust the stamp, not
      // only the "still in the future" flag. An optimistic unsnooze clears both.
      return (c.snoozed || !!c.snoozedUntil) && !isDone(c, now);
    case "done":
      return isDone(c, now);
    case "open":
      return c.status === "open" && !c.snoozed;
  }
}

export interface DeriveRowsOptions {
  tab: InboxListTab;
  filters: InboxFilters;
  chip: QuickChip;
  sort: SortPreference;
  /** Conversations the agent marked unread locally. */
  forcedUnread: ReadonlySet<string>;
  now: Date;
  /**
   * The open conversation always stays in the rows. Opening it marks it read,
   * which would otherwise drop it from the Unread chip / status filters and
   * make the selection cascade down the list, marking each next row read.
   */
  selectedId?: string | null;
}

/** tab predicate → forced unread → filters → unread chip → sort. */
export function deriveRows(conversations: Conversation[], opts: DeriveRowsOptions): Conversation[] {
  const { tab, filters, chip, sort, forcedUnread, now, selectedId = null } = opts;
  const withoutStatus: InboxFilters = { ...filters, status: [] };
  const rows = conversations
    .filter((c) => matchesTab(c, tab, now))
    .map((c) => (forcedUnread.has(c.id) && !c.unread ? { ...c, unread: true } : c))
    .filter((c) => matchesFilters(c, c.id === selectedId ? withoutStatus : filters, now))
    .filter((c) => chip !== "unread" || c.unread || c.id === selectedId);
  return applySort(rows, sort.key, { unreadFirst: sort.unreadFirst, now });
}

/** Union of two lists by id; the first occurrence wins. */
export function mergeById<T extends { id: string }>(a: readonly T[], b: readonly T[]): T[] {
  const seen = new Set<string>();
  const out: T[] = [];
  for (const item of [...a, ...b]) {
    if (seen.has(item.id)) continue;
    seen.add(item.id);
    out.push(item);
  }
  return out;
}
