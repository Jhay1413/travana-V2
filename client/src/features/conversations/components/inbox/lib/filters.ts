import type { Conversation, ConversationChannel } from "../../../types";
import { rowStatus } from "./row-status";

export type AssignedFilter = "anyone" | "me" | "unassigned";
export type StatusFilter = "needs_reply" | "waiting" | "overdue";
export type LastMessageFilter = "any" | "today" | "week";
export type QuickChip = "all" | "unread" | "needs_reply" | "mine";

export interface InboxFilters {
  channels: ConversationChannel[];
  assigned: AssignedFilter;
  /** Tag ids. */
  tags: string[];
  status: StatusFilter[];
  lastMessage: LastMessageFilter;
}

export interface InboxServerParams {
  assignedTo?: "me" | "unassigned";
  needsReply?: boolean;
}

export const EMPTY_FILTERS: InboxFilters = {
  channels: [],
  assigned: "anyone",
  tags: [],
  status: [],
  lastMessage: "any",
};

export function countActiveFilters(f: InboxFilters): number {
  return (
    (f.channels.length > 0 ? 1 : 0) +
    (f.assigned !== "anyone" ? 1 : 0) +
    (f.tags.length > 0 ? 1 : 0) +
    (f.status.length > 0 ? 1 : 0) +
    (f.lastMessage !== "any" ? 1 : 0)
  );
}

function startOfDay(d: Date): number {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
}

/**
 * Client-side filters; `assigned` is intentionally ignored (server-side).
 * Status values are OR-ed: needs_reply = needs reply incl. overdue,
 * overdue = needs reply for 24h+, waiting = rowStatus kind "waiting".
 */
export function matchesFilters(conv: Conversation, f: InboxFilters, now: Date): boolean {
  if (f.channels.length > 0 && !f.channels.includes(conv.channel)) return false;
  if (f.tags.length > 0 && !(conv.tags ?? []).some((t) => f.tags.includes(t.id))) return false;
  if (f.status.length > 0) {
    const kind = rowStatus(conv, now).kind;
    const ok = f.status.some((s) => (s === "needs_reply" ? kind === "needs_reply" || kind === "overdue" : kind === s));
    if (!ok) return false;
  }
  if (f.lastMessage !== "any") {
    const t = Date.parse(conv.lastActivityAt);
    if (Number.isNaN(t)) return false;
    const cutoff = f.lastMessage === "today" ? startOfDay(now) : now.getTime() - 7 * 86_400_000;
    if (t < cutoff) return false;
  }
  return true;
}

/** Chip "mine" overrides `assigned`; chip "needs_reply" asks the server for needs-reply only. */
export function serverParamsFor(f: InboxFilters, chip: QuickChip): InboxServerParams {
  const params: InboxServerParams = {};
  if (chip === "mine") params.assignedTo = "me";
  else if (f.assigned === "me" || f.assigned === "unassigned") params.assignedTo = f.assigned;
  if (chip === "needs_reply") params.needsReply = true;
  return params;
}

export function channelCounts(rows: Conversation[]): Record<ConversationChannel, number> {
  const counts: Record<ConversationChannel, number> = { email: 0, sms: 0, whatsapp: 0, messenger: 0, instagram: 0 };
  for (const r of rows) counts[r.channel] += 1;
  return counts;
}
