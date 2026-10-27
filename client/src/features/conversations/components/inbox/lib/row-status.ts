import type { Conversation } from "../../../types";
import { snoozeLabel } from "./snooze";

export type RowStatusKind = "needs_reply" | "overdue" | "waiting" | "snoozed" | "done";
export type LastDirection = "inbound" | "outbound";

export const OVERDUE_AFTER_MS = 24 * 60 * 60 * 1000;
const DONE_SNOOZE_DAYS = 300;
const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

/**
 * Direction of the last customer-visible message, or null when unknown. Uses the
 * explicit `lastDirection` override first, else the last non-note entry of
 * `conv.messages` (the list mapper seeds it from `last_message`, flagging
 * internal notes). Null means no message to judge by (none, or only notes).
 */
export function lastDirectionOf(conv: Conversation, lastDirection?: LastDirection): LastDirection | null {
  if (lastDirection) return lastDirection;
  for (let i = conv.messages.length - 1; i >= 0; i--) {
    if (!conv.messages[i].isNote) return conv.messages[i].direction;
  }
  return null;
}

/**
 * True when the client is waiting on us: the last customer-visible message is
 * inbound, regardless of read/seen state. With no message to judge by we trust
 * the provider's raw `needsReply` flag (never the locally-cleared `unread`).
 */
export function needsReplyOf(conv: Conversation, lastDirection?: LastDirection): boolean {
  const dir = lastDirectionOf(conv, lastDirection);
  return dir === null ? conv.needsReply : dir === "inbound";
}

/**
 * Milliseconds a client has been waiting on us; null unless the last
 * customer-visible message is inbound. Measured from that message's sentAt when
 * known, else from lastActivityAt.
 */
export function waitMs(conv: Conversation, now: Date, lastDirection?: LastDirection): number | null {
  if (!needsReplyOf(conv, lastDirection)) return null;
  let at = Number.NaN;
  for (let i = conv.messages.length - 1; i >= 0; i--) {
    const m = conv.messages[i];
    if (m.isNote) continue;
    if (m.direction === "inbound") at = Date.parse(m.sentAt);
    break;
  }
  if (Number.isNaN(at)) at = Date.parse(conv.lastActivityAt);
  if (Number.isNaN(at)) return null;
  return Math.max(0, now.getTime() - at);
}

/** "4m", "1h", "1d 19h". */
export function formatWait(ms: number): string {
  const total = Math.max(0, ms);
  if (total >= DAY) {
    const days = Math.floor(total / DAY);
    const hours = Math.floor((total % DAY) / HOUR);
    return hours > 0 ? `${days}d ${hours}h` : `${days}d`;
  }
  if (total >= HOUR) return `${Math.floor(total / HOUR)}h`;
  return `${Math.floor(total / MINUTE)}m`;
}

/**
 * "Mark done" is modelled as a year-long snooze (SendSeven's close endpoint is
 * out of scope), so a snooze 300+ days out is treated as "done".
 */
export function isDoneSnooze(until: string | undefined | null, now: Date): boolean {
  if (!until) return false;
  const t = Date.parse(until);
  return !Number.isNaN(t) && t - now.getTime() >= DONE_SNOOZE_DAYS * DAY;
}

export function rowStatus(
  conv: Conversation,
  now: Date,
  lastDirection?: LastDirection,
): { kind: RowStatusKind; label: string } {
  if (conv.status === "closed" || isDoneSnooze(conv.snoozedUntil, now)) {
    return { kind: "done", label: "Done" };
  }
  if (conv.snoozed && conv.snoozedUntil) {
    const until = new Date(conv.snoozedUntil);
    if (!Number.isNaN(until.getTime())) return { kind: "snoozed", label: snoozeLabel(until, now) };
  }
  // Snoozed with no (parseable) return time, e.g. the optimistic local override.
  if (conv.snoozed) return { kind: "snoozed", label: "Snoozed" };
  // A lapsed snooze the provider still reports: nothing new has arrived, so the
  // most useful label is that the snooze has ended (a row still awaiting our
  // reply keeps its needs-reply label below).
  if (conv.snoozedUntil && !needsReplyOf(conv, lastDirection)) {
    const until = Date.parse(conv.snoozedUntil);
    if (!Number.isNaN(until) && until <= now.getTime()) return { kind: "snoozed", label: "Snooze ended" };
  }
  const wait = waitMs(conv, now, lastDirection);
  if (wait !== null) {
    return wait >= OVERDUE_AFTER_MS
      ? { kind: "overdue", label: `Overdue · ${formatWait(wait)}` }
      : { kind: "needs_reply", label: `Needs reply · ${formatWait(wait)}` };
  }
  const since = now.getTime() - Date.parse(conv.lastActivityAt);
  return { kind: "waiting", label: `Waiting ${formatWait(Number.isNaN(since) ? 0 : since)}` };
}
