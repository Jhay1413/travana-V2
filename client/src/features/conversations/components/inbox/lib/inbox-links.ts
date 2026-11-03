import type { Conversation } from "../../../types";
import { isDoneSnooze } from "./row-status";

// Pure helpers for inbox deep links (?conversation=, ?client=) and for picking
// which of a client's conversations to open. No React, no I/O.

export interface InboxDeepLinkParams {
  conversationId: string | null;
  clientId: string | null;
}

/** Reads the deep-link params out of a location search string. */
export function parseInboxDeepLink(search: string): InboxDeepLinkParams {
  const params = new URLSearchParams(search);
  return {
    conversationId: params.get("conversation")?.trim() || null,
    clientId: params.get("client")?.trim() || null,
  };
}

/** "Message this client": the inbox resolves the client to a conversation itself. */
export function buildClientInboxHref(clientId: string): string {
  return `/conversations?client=${encodeURIComponent(clientId)}`;
}

export function buildConversationInboxHref(conversationId: string): string {
  return `/conversations?conversation=${encodeURIComponent(conversationId)}`;
}

export type OpenableTab = "open" | "snoozed" | "done";

type TabFields = Pick<Conversation, "status" | "snoozed" | "snoozedUntil">;

/** The inbox tab a conversation is listed under. */
export function tabForConversation(c: TabFields, now: Date): OpenableTab {
  if (c.status === "closed") return "done";
  if (isDoneSnooze(c.snoozedUntil, now)) return "done";
  if (c.snoozedUntil) return "snoozed";
  if (c.snoozed) return "snoozed";
  return "open";
}

function recency(c: Pick<Conversation, "lastActivityAt">): number {
  const t = Date.parse(c.lastActivityAt);
  return Number.isFinite(t) ? t : 0;
}

export interface ConversationToOpen {
  id: string;
  tab: OpenableTab;
}

/**
 * The most recent OPEN conversation, else the most recent of any status.
 * Null when the client has no conversation at all.
 */
export function pickConversationToOpen(
  conversations: readonly Pick<Conversation, "id" | "status" | "snoozed" | "snoozedUntil" | "lastActivityAt">[],
  now: Date,
): ConversationToOpen | null {
  if (conversations.length === 0) return null;
  const newestFirst = [...conversations].sort((a, b) => recency(b) - recency(a));
  const open = newestFirst.find((c) => tabForConversation(c, now) === "open");
  const chosen = open ?? newestFirst[0];
  return { id: chosen.id, tab: tabForConversation(chosen, now) };
}

export interface DeepLinkPendingInput {
  urlSearch: string;
  /** Last conversation / client id the hook acted on (null before the first effect). */
  appliedConversation: string | null;
  appliedClient: string | null;
  /** Conversation id still being fetched by id. */
  targetId: string | null;
  /** Client id still resolving to a conversation. */
  clientTarget: string | null;
}

export interface DeepLinkPending {
  /** A client target is unapplied or still resolving: no conversation should be shown. */
  client: boolean;
  /** The conversation id the inbox is about to open, if any. */
  conversationId: string | null;
}

/**
 * What the URL asks for that the inbox has not finished opening. Computed from
 * the URL itself, so it is true on the very first render, before any effect has
 * had the chance to apply the deep link (which is what stops the latest
 * conversation flashing first).
 */
export function deepLinkPending(input: DeepLinkPendingInput): DeepLinkPending {
  const { conversationId, clientId } = parseInboxDeepLink(input.urlSearch);
  const unappliedConversation = conversationId && conversationId !== input.appliedConversation ? conversationId : null;
  const unappliedClient = clientId && clientId !== input.appliedClient ? clientId : null;
  return {
    client: !!(unappliedClient || input.clientTarget),
    conversationId: input.targetId ?? unappliedConversation,
  };
}
