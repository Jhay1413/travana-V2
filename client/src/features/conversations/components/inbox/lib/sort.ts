import type { Conversation } from "../../../types";
import { waitMs } from "./row-status";

export type SortKey = "latest" | "longest_waiting" | "unread_first" | "name";

export const SORT_OPTIONS: { key: SortKey; label: string; sub: string }[] = [
  { key: "latest", label: "Latest activity", sub: "Newest message first" },
  { key: "longest_waiting", label: "Longest waiting", sub: "Clients waiting on you the longest" },
  { key: "unread_first", label: "Unread first", sub: "Then newest" },
  { key: "name", label: "Client name", sub: "A to Z" },
];

export interface SortOptions {
  unreadFirst: boolean;
  now: Date;
}

export type ConversationComparator = (a: Conversation, b: Conversation) => number;

function time(c: Conversation): number {
  const t = Date.parse(c.lastActivityAt);
  return Number.isNaN(t) ? 0 : t;
}

const byLatest: ConversationComparator = (a, b) => time(b) - time(a);

export function comparatorFor(key: SortKey, opts: SortOptions): ConversationComparator {
  let base: ConversationComparator;
  switch (key) {
    case "longest_waiting":
      base = (a, b) => {
        const wa = waitMs(a, opts.now);
        const wb = waitMs(b, opts.now);
        if (wa === null && wb === null) return byLatest(a, b);
        if (wa === null) return 1;
        if (wb === null) return -1;
        return wb - wa || byLatest(a, b);
      };
      break;
    case "name":
      base = (a, b) =>
        a.contact.displayName.localeCompare(b.contact.displayName, undefined, { sensitivity: "base" });
      break;
    case "unread_first":
    case "latest":
      base = byLatest;
      break;
  }
  if (!(opts.unreadFirst || key === "unread_first")) return base;
  return (a, b) => Number(b.unread) - Number(a.unread) || base(a, b);
}

/** Returns a new, stably sorted array. */
export function applySort(rows: Conversation[], key: SortKey, opts: SortOptions): Conversation[] {
  return [...rows].sort(comparatorFor(key, opts));
}
