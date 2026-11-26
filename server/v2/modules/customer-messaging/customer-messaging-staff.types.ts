import type { QuoteWhatsappFallbackReason } from "../quote-share/quote-share.types";
import type { AutoChannel, SkipReason } from "./customer-messaging.types";

// Types for the messages a staff member sends by hand (quote link, portal sign-in link), the "Send by" availability
// check, and the per-client message history. None of them carries a message body, phone number or link.

/** The two messages staff can send with a choice of channel. */
export const STAFF_PURPOSES = ["quote_link", "portal_sign_in"] as const;
export type StaffPurpose = (typeof STAFF_PURPOSES)[number];

export interface ChannelAvailability {
  available: boolean;
  /** Plain-language reason, present only when the channel is not available. */
  reason?: string;
  /** Present on an available channel that will not go through the agency inbox (e.g. "Opens WhatsApp on your device"). */
  note?: string;
}

export interface AvailabilityResult {
  /** The agency's channel setting (WhatsApp when never set): what the "Send by" choice starts on. */
  defaultChannel: AutoChannel;
  channels: Record<AutoChannel, ChannelAvailability>;
}

export interface StaffWhatsappFallback {
  reason: QuoteWhatsappFallbackReason;
  /** The message text, so the staff member can send it from their own phone with a wa.me link. */
  text: string;
  /** The public quote link (quote messages only). A sign-in fallback never exposes its one-time link outside `text`. */
  quoteUrl?: string;
  detail?: string;
}

export type StaffSendResult =
  | { status: "sent"; channel: AutoChannel; viaTemplate?: boolean }
  | { status: "not_sent"; channel: AutoChannel; reason: SkipReason; message: string }
  | { status: "fallback"; channel: "whatsapp"; fallback: StaffWhatsappFallback };

export interface StaffSendInput {
  clientId: string;
  purpose: StaffPurpose;
  channel: AutoChannel;
  quoteId?: string;
}

/** One history row. Exactly these keys, nothing else: no body, no phone number, no link, no provider id. */
export interface MessageLogEntry {
  id: string;
  purpose: string;
  channel: string;
  status: string;
  /** Plain text ("The customer has opted out"), null when the message was sent. */
  reason: string | null;
  templateName: string | null;
  triggerSource: string | null;
  /** Who pressed send; null for automatic messages. */
  triggeredByName: string | null;
  createdAt: string;
}

export const MESSAGE_LOG_ENTRY_KEYS = ["id", "purpose", "channel", "status", "reason", "templateName", "triggerSource", "triggeredByName", "createdAt"] as const;

export interface MessageLogPage {
  items: MessageLogEntry[];
  nextCursor: string | null;
  /** True when the log table is not in the database yet: the list is empty and that is not an error. */
  unavailable: boolean;
}

/** A raw log row as the repository reads it (reason is still the stored code). */
export interface MessageLogRow {
  id: string;
  purpose: string;
  channel: string;
  status: string;
  reason: string | null;
  templateName: string | null;
  triggerSource: string | null;
  triggeredByName: string | null;
  createdAt: Date;
}
