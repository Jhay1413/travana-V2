/** The two channels a staff member can pick for a message they send by hand. */
export type SendChannel = "whatsapp" | "sms";

/** The messages staff can send with a choice of channel. */
export type StaffMessagePurpose = "quote_link" | "portal_sign_in";

export interface ChannelAvailability {
  available: boolean;
  /** Plain-language reason, present only when the channel is not available. */
  reason?: string;
  /** On an available option that opens WhatsApp on the staff member's own device instead of sending from the inbox. */
  note?: string;
}

export interface SendAvailability {
  /** The agency's channel setting; what the choice starts on. */
  defaultChannel: SendChannel;
  channels: Record<SendChannel, ChannelAvailability>;
}

export type WhatsappFallbackReason = "not_allowed" | "not_configured" | "no_contact" | "no_channel" | "window_closed" | "template_failed";

export interface WhatsappFallback {
  reason: WhatsappFallbackReason;
  /** The message text, for the wa.me button (the staff member sends it from their own phone). */
  text: string;
  /** The public quote link (quote messages only). */
  quoteUrl?: string;
  detail?: string;
}

export type StaffSendResult =
  | { status: "sent"; channel: SendChannel; viaTemplate?: boolean }
  | { status: "not_sent"; channel: SendChannel; reason: string; message: string }
  | { status: "fallback"; channel: "whatsapp"; fallback: WhatsappFallback };

export interface StaffSendInput {
  clientId: string;
  purpose: StaffMessagePurpose;
  channel: SendChannel;
  quoteId?: string;
}

/** One row of a client's message history. There is never a message body, phone number or link. */
export interface MessageLogEntry {
  id: string;
  purpose: string;
  channel: string;
  /** sent | skipped | pending */
  status: string;
  /** Plain-text fragment ("customer opted out"); null when the message was sent. */
  reason: string | null;
  templateName: string | null;
  triggerSource: string | null;
  triggeredByName: string | null;
  createdAt: string;
}

export interface MessageLogPage {
  items: MessageLogEntry[];
  nextCursor: string | null;
  /** The log table is not in the database yet: nothing to show, and that is not an error. */
  unavailable: boolean;
}
