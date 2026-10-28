import type { QuoteTemplateVariable } from "@shared/schema";

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

/** Per-org WhatsApp quote-template settings as exposed over the API. */
export interface QuoteTemplateSettings {
  templateName: string | null;
  templateLanguage: string | null;
  channelId: string | null;
  variables: Record<string, QuoteTemplateVariable>;
}

/** SendSeven POST /whatsapp-templates/{name_or_id}/send request. */
export interface SendTemplateRequest {
  contact_id?: string;
  /** Phone digits without "+"; with contact_id, SendSeven adds the WhatsApp method to that contact. */
  whatsapp_id?: string;
  channel_id?: string;
  conversation_id?: string | null;
  language?: string | null;
  variable_values?: Record<string, string>;
}

/** SendSeven POST /whatsapp-templates/{name_or_id}/send response. */
export interface SendTemplateResponse {
  success: boolean;
  message_id: string | null;
  external_id: string | null;
  conversation_id: string;
  error: string | null;
  error_code: number | string | null;
  error_details: string | null;
}
