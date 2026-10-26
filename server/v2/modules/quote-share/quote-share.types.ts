/** Why a quote could not be sent through SendSeven; the client falls back to a wa.me link. */
export type QuoteWhatsappFallbackReason =
  | "not_allowed"
  | "not_configured"
  | "no_contact"
  | "no_channel"
  | "window_closed";

export type SendQuoteWhatsappResult =
  | { status: "sent"; conversationId: string }
  | { status: "fallback"; reason: QuoteWhatsappFallbackReason; text: string; quoteUrl: string };

/** Window info SendSeven attaches to conversation lookups (untyped upstream). */
export interface WhatsappWindowInfo {
  requires_template?: boolean;
  window_status?: Record<string, unknown> | null;
}

/** Mirrors the client's CheckExistingConversationResponse (the fields we read). */
export interface CheckExistingResponse extends WhatsappWindowInfo {
  has_existing_open: boolean;
  existing_open_conversation_id?: string | null;
}

/** Mirrors the client's OpenOrCreateConversationResponse (the fields we read). */
export interface OpenOrCreateResponse extends WhatsappWindowInfo {
  conversation_id: string;
}
