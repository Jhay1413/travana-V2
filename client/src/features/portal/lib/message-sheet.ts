/** Pure rules for the "Message <agent>" sheet: what it is about, what to add, how the one chat message is written. */
import type { PortalBookingListItem } from "@shared/portal-bookings";
import type { PortalQuoteListItem } from "@shared/portal-quotes";
import type { PortalSummaryNextBooking } from "@shared/portal-summary";
import { splitQuotes } from "./quote-decision";

/** The design's "Add quickly" chips, verbatim. */
export const MESSAGE_EXTRAS = ["Room with a view", "Celebrating something", "Airport parking", "Extra luggage", "Dietary needs", "Transfer upgrade", "Travel insurance"] as const;

export type ReplyBy = "email" | "whatsapp" | "call";

/** The design's "<agent> will reply by" choices, in order. The first is the default. */
export const REPLY_OPTIONS: ReadonlyArray<{ key: ReplyBy; label: string }> = [
  { key: "email", label: "Email" },
  { key: "whatsapp", label: "WhatsApp" },
  { key: "call", label: "Phone call" },
];
export const DEFAULT_REPLY_BY: ReplyBy = "email";

export const EMPTY_MESSAGE_ERROR = "Write a few words, or pick something above.";
export const SEND_FAILED_ERROR = "That didn't send. Please try again.";

/** The server accepts 5000 characters in one message; the typed part is kept well under that so the added lines always fit. */
export const MAX_MESSAGE_TEXT = 3000;
const MAX_ABOUT_LABEL = 200;
export const OTHER_LABEL = "Something else";

export interface AboutOption {
  /** `booking:<id>`, `quote:<id>` or `other`. */
  key: string;
  label: string;
  /** A quote's share token, so a quote screen (whose address holds the token) can preselect it. */
  token?: string;
}

/** What a screen can say the message is about. */
export type MessageAbout = { kind: "booking"; id: string } | { kind: "quote"; id: string } | { kind: "other" };

export function aboutKey(about: MessageAbout): string {
  return about.kind === "other" ? "other" : `${about.kind}:${about.id}`;
}

/**
 * The preselection for a screen when the opener did not name one: a quote screen means that quote (`quote-token:`),
 * a booking screen that booking; everywhere else the default rule applies (null).
 */
export function aboutFromPath(pathname: string): string | null {
  const path = pathname.split(/[?#]/)[0].replace(/\/+$/, "");
  const quote = /^\/portal\/quote\/([^/]+)$/.exec(path);
  if (quote) return `quote-token:${decodeURIComponent(quote[1])}`;
  const booking = /^\/portal\/booking\/([^/]+)$/.exec(path);
  if (booking) return aboutKey({ kind: "booking", id: decodeURIComponent(booking[1]) });
  return null;
}

const cap = (s: string): string => s.trim().slice(0, MAX_ABOUT_LABEL);

/**
 * The "It's about" list: upcoming bookings by title (soonest first), then open quotes by hotel (else title), then
 * "Something else". A booking the list has not delivered (yet) but the summary names as the next one is still offered.
 */
export function buildAboutOptions(input: {
  bookings: readonly PortalBookingListItem[] | undefined;
  quotes: readonly PortalQuoteListItem[] | undefined;
  nextBooking?: PortalSummaryNextBooking | null;
}): AboutOption[] {
  const options: AboutOption[] = [];
  const upcoming = [...(input.bookings ?? [])]
    .filter((b) => b.trip_status !== "past")
    .sort((a, b) => new Date(a.travel_date).getTime() - new Date(b.travel_date).getTime());
  for (const b of upcoming) options.push({ key: aboutKey({ kind: "booking", id: b.id }), label: cap(b.title || b.hotel || b.destination || "Your booking") });
  const next = input.nextBooking;
  if (next && !upcoming.some((b) => b.id === next.id)) {
    options.unshift({ key: aboutKey({ kind: "booking", id: next.id }), label: cap(next.title || next.destination || "Your booking") });
  }
  for (const q of splitQuotes([...(input.quotes ?? [])]).active) {
    options.push({ key: aboutKey({ kind: "quote", id: q.id }), label: cap(q.hotel || q.title || q.destination || "Your quote"), token: q.token });
  }
  options.push({ key: "other", label: OTHER_LABEL });
  return options;
}

/** The next booking if there is one, else the first quote, else "Something else". */
export function defaultAboutKey(options: readonly AboutOption[]): string {
  return (options.find((o) => o.key.startsWith("booking:")) ?? options.find((o) => o.key.startsWith("quote:")) ?? options[options.length - 1])?.key ?? "other";
}

/** The option to show as chosen: the one asked for when it is in the list, else the default. */
export function resolveAbout(options: readonly AboutOption[], preferred: string | null): AboutOption {
  const wanted = preferred?.startsWith("quote-token:") ? options.find((o) => o.token === preferred.slice("quote-token:".length)) : options.find((o) => o.key === preferred);
  const fallback = options.find((o) => o.key === defaultAboutKey(options));
  return wanted ?? fallback ?? { key: "other", label: OTHER_LABEL };
}

export interface MessageDraft {
  extras: readonly string[];
  text: string;
  via: ReplyBy;
}

export const EMPTY_DRAFT: MessageDraft = { extras: [], text: "", via: DEFAULT_REPLY_BY };

/** "" when the draft can be sent, else the design's message. Something typed or one chip is enough. */
export function validateDraft(draft: Pick<MessageDraft, "extras" | "text">): string {
  return draft.text.trim() || draft.extras.length > 0 ? "" : EMPTY_MESSAGE_ERROR;
}

/** The chosen extras in the design's own order (not the order they were tapped). */
export function orderedExtras(extras: readonly string[]): string[] {
  return MESSAGE_EXTRAS.filter((e) => extras.includes(e));
}

export function replyLabel(via: ReplyBy): string {
  return REPLY_OPTIONS.find((o) => o.key === via)?.label ?? "Email";
}

/**
 * The one chat message the agent receives, plain and readable, one part per line and none for an empty part:
 *   About: <label> / Would like: <extras> / <the customer's words> / Reply by: <choice>
 */
export function composeMessage(input: { about: string; draft: MessageDraft }): string {
  const lines = [`About: ${cap(input.about)}`];
  const extras = orderedExtras(input.draft.extras);
  if (extras.length > 0) lines.push(`Would like: ${extras.join(", ")}`);
  const text = input.draft.text.trim().slice(0, MAX_MESSAGE_TEXT);
  if (text) lines.push(text);
  lines.push(`Reply by: ${replyLabel(input.draft.via)}`);
  return lines.join("\n");
}

/** "today at 09:05", as the design stamps a sent message. */
export function sentStamp(now: Date): string {
  return `today at ${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
}

/** The agent as a sentence starts or ends: their first name, else "Your agent". */
export function agentWho(agent: string): string {
  return agent === "your agent" ? "Your agent" : agent;
}

/** The line under the sent message; "here" is true because the reply lands in the chat. */
export function replyLine(agent: string, via: ReplyBy): string {
  const who = agentWho(agent);
  if (via === "call") return `${who} will give you a call to talk it through.`;
  return `${who} will reply by ${via === "whatsapp" ? "WhatsApp" : "email"}, and you’ll see it here too.`;
}

/** Two letters for the agent's circle ("JL" for "James Lee"), one for a single name, "A" with no name. */
export function agentInitials(fullName: string | null | undefined): string {
  const words = (fullName ?? "").trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return "A";
  const first = words[0].charAt(0);
  const last = words.length > 1 ? words[words.length - 1].charAt(0) : "";
  return (first + last).toUpperCase();
}
