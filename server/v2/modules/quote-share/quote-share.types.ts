import type { WhatsappTemplateSettings, WhatsappWindowInfo } from "../whatsapp-templates/whatsapp-templates.types";

/** Why a quote could not be sent through SendSeven; the client falls back to a wa.me link. */
export type QuoteWhatsappFallbackReason =
  | "not_allowed"
  | "not_configured"
  | "no_contact"
  | "no_channel"
  | "window_closed"
  | "template_failed";

export type SendQuoteWhatsappResult =
  | { status: "sent"; conversationId: string; viaTemplate?: boolean }
  | { status: "fallback"; reason: QuoteWhatsappFallbackReason; text: string; quoteUrl: string; detail?: string };

/** Mirrors the client's CheckExistingConversationResponse (the fields we read). */
export interface CheckExistingResponse extends WhatsappWindowInfo {
  has_existing_open: boolean;
  existing_open_conversation_id?: string | null;
}

/** Mirrors the client's OpenOrCreateConversationResponse (the fields we read). */
export interface OpenOrCreateResponse extends WhatsappWindowInfo {
  conversation_id: string;
}

/** Per-org WhatsApp quote-template settings as exposed over the API. */
export type QuoteTemplateSettings = WhatsappTemplateSettings;
