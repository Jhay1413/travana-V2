import type { MessageLogEntry } from "../types";

const PURPOSE_LABEL: Record<string, string> = {
  booking_confirmation: "Booking confirmation",
  portal_ready: "Portal ready",
  balance_reminder: "Balance reminder",
  departure_reminder: "Departure reminder",
  portal_sign_in: "Portal sign-in link",
  quote_link: "Quote link",
};

const CHANNEL_LABEL: Record<string, string> = { whatsapp: "WhatsApp", sms: "SMS" };

function humanise(code: string): string {
  const text = code.replace(/_/g, " ").trim();
  return text ? text.charAt(0).toUpperCase() + text.slice(1) : "Message";
}

export const purposeLabel = (purpose: string): string => PURPOSE_LABEL[purpose] ?? humanise(purpose);
export const logChannelLabel = (channel: string): string => CHANNEL_LABEL[channel] ?? "Unknown channel";

const WHEN = new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/London", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", hourCycle: "h23" });

/** "24 Nov 14:02" in UK time. */
export function formatLogTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const p: Record<string, string> = {};
  for (const part of WHEN.formatToParts(d)) if (part.type !== "literal") p[part.type] = part.value;
  return `${p.day} ${p.month} ${p.hour}:${p.minute}`;
}

/** "Sent", "Sending" or "Not sent — customer opted out". */
export function statusText(entry: Pick<MessageLogEntry, "status" | "reason">): string {
  if (entry.status === "sent") return "Sent";
  if (entry.status === "pending") return "Sending";
  return entry.reason ? `Not sent — ${entry.reason}` : "Not sent";
}

export interface LogRowView {
  /** "Booking confirmation · WhatsApp · Sent · 24 Nov 14:02" */
  line: string;
  /** Small second line: who sent it and which template, when known. */
  detail: string | null;
  sent: boolean;
}

export function formatLogRow(entry: MessageLogEntry): LogRowView {
  const when = formatLogTime(entry.createdAt);
  const line = [purposeLabel(entry.purpose), logChannelLabel(entry.channel), statusText(entry), when].filter(Boolean).join(" · ");
  const bits = [entry.triggeredByName ? `by ${entry.triggeredByName}` : null, entry.templateName ? `template ${entry.templateName}` : null].filter(Boolean);
  return { line, detail: bits.length > 0 ? bits.join(" · ") : null, sent: entry.status === "sent" };
}
