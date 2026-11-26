/** Pure rules for the portal Messages screen: what is shown, in which day group, and when Send is allowed. */
import type { PortalMessage } from "@/hooks/use-portal-api";

/** "09:30" in the customer's own time zone; "" for something that is not a date. */
export function formatTime(dateStr: string): string {
  const date = new Date(dateStr);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
}

/** A customer's clock can run a little behind the server's; a server message this much earlier than the local send still counts as that send. */
const CLOCK_SKEW_MS = 10_000;

const time = (iso: string): number => {
  const t = new Date(iso).getTime();
  return Number.isNaN(t) ? 0 : t;
};

/**
 * The server's messages followed by the ones sent from this screen that the server has not returned yet.
 *
 * A sent message is matched to a server message one to one: same text, from the customer, and stamped by the server
 * at or after the moment it was sent here (allowing for a little clock skew); each server message is used for one
 * sent message only. So sending "Thanks" again later shows a second bubble, and an old "Thanks" never hides it.
 * A sent message that is still sending or has failed (`unsettledIds`) is always shown; if the server already has its
 * copy, that copy is dropped so it does not show twice.
 */
export function mergeMessages(fromServer: PortalMessage[], sentHere: PortalMessage[], unsettledIds: ReadonlySet<string> = new Set()): PortalMessage[] {
  const used = new Set<number>();
  const dropped = new Set<number>();
  const shown: PortalMessage[] = [];
  const oldestFirst = [...sentHere].sort((a, b) => time(a.timestamp) - time(b.timestamp));
  for (const local of oldestFirst) {
    const sentAt = time(local.timestamp);
    let best = -1;
    fromServer.forEach((m, i) => {
      if (used.has(i) || m.sender !== "client" || m.text !== local.text) return;
      const at = time(m.timestamp);
      if (at < sentAt - CLOCK_SKEW_MS) return;
      if (best === -1 || at < time(fromServer[best].timestamp)) best = i;
    });
    if (best !== -1) used.add(best);
    if (best === -1 || unsettledIds.has(local.id)) {
      shown.push(local);
      if (best !== -1) dropped.add(best);
    }
  }
  return [...fromServer.filter((_, i) => !dropped.has(i)), ...shown];
}

/** Send needs some text that is not only spaces, and no send already in flight. */
export function canSend(input: string, sending: boolean): boolean {
  return input.trim().length > 0 && !sending;
}

function startOfDay(d: Date): number {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
}

/** "Today", "Yesterday", else "Mon 3 Nov" (with the year when it is not this year). */
export function dayLabel(date: Date, now: Date): string {
  const diffDays = Math.round((startOfDay(now) - startOfDay(date)) / 86_400_000);
  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Yesterday";
  const sameYear = date.getFullYear() === now.getFullYear();
  return date.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", ...(sameYear ? {} : { year: "numeric" }) });
}

export interface MessageDay {
  /** The calendar day, stable across renders ("2026-11-3"). */
  key: string;
  label: string;
  messages: PortalMessage[];
}

/** Messages in the order given, split into one group per calendar day. A message with no valid date joins the previous group. */
export function groupMessagesByDay(messages: PortalMessage[], now: Date = new Date()): MessageDay[] {
  const days: MessageDay[] = [];
  for (const message of messages) {
    const date = new Date(message.timestamp);
    const valid = !Number.isNaN(date.getTime());
    const key = valid ? `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}` : (days[days.length - 1]?.key ?? "unknown");
    const last = days[days.length - 1];
    if (last && last.key === key) {
      last.messages.push(message);
    } else {
      days.push({ key, label: valid ? dayLabel(date, now) : "", messages: [message] });
    }
  }
  return days;
}
