import type { WhatsappTemplateVariable } from "@shared/schema";

// SendSeven WhatsApp template shapes used by the proxy. Templates live in
// SendSeven (per tenant); Travana stores nothing.

export type TemplateCategory = "MARKETING" | "UTILITY" | "AUTHENTICATION";
export type ButtonType = "URL" | "QUICK_REPLY" | "PHONE_NUMBER";

export interface SsTemplateButton {
  type: ButtonType;
  text: string;
  url?: string | null;
  phone_number?: string | null;
}

export interface SsWhatsappTemplate {
  id: string;
  tenant_id?: string;
  channel_id?: string;
  waba_id?: string | null;
  template_id?: string | null;
  name: string;
  language?: string;
  category?: string;
  header_type?: "NONE" | "TEXT" | "IMAGE" | "VIDEO" | "DOCUMENT" | null;
  header_text?: string | null;
  body_text?: string | null;
  footer_text?: string | null;
  buttons?: SsTemplateButton[] | null;
  variable_mapping?: unknown;
  status?: "PENDING" | "APPROVED" | "REJECTED" | "PAUSED" | "DISABLED" | string;
  quality_score?: string | null;
  parameter_format?: "positional" | "named" | null;
  last_synced_at?: string | null;
  created_at?: string;
  updated_at?: string;
  [key: string]: unknown;
}

export interface SsTemplateList {
  templates: SsWhatsappTemplate[];
  total: number;
  channel_id?: string | null;
  status_filter?: string | null;
}

export interface TemplateListQuery {
  channel_id?: string;
  status?: string;
}

export interface SsSyncResult {
  synced: number;
  added: number;
  updated: number;
  removed: number;
  errors: string[];
}

export interface SsTemplateComponent {
  type: "HEADER" | "BODY" | "FOOTER" | "BUTTONS";
  format?: "TEXT";
  text?: string;
  example?: { body_text: string[][] };
  buttons?: SsTemplateButton[];
}

export interface SsCreateTemplateBody {
  channel_id: string;
  name: string;
  category: TemplateCategory;
  language?: string;
  components: SsTemplateComponent[];
  allow_category_change?: boolean;
}

export interface SsCreateTemplateResponse {
  success: boolean;
  id?: string | null;
  template_id?: string | null;
  status?: string | null;
  error?: string | null;
  error_code?: string | number | null;
  error_is_retryable?: boolean | null;
  meta_message?: string | null;
  meta_user_title?: string | null;
  meta_user_message?: string | null;
  meta_details?: unknown;
  [key: string]: unknown;
}

// Travana's request body (already validated).
export interface CreateTemplateInput {
  channel_id: string;
  name: string;
  category: "MARKETING" | "UTILITY";
  language: string;
  header_text?: string;
  body_text: string;
  body_examples: string[];
  footer_text?: string;
  buttons?: SsTemplateButton[];
}

export interface CreateTemplateResult {
  id: string | null;
  template_id: string | null;
  status: string | null;
}

// ── Sending a template (shared by the quote and general-update sends) ──

/** Window info SendSeven attaches to conversation lookups. */
export interface WhatsappWindowStatus {
  in_window?: boolean;
  requires_template?: boolean;
  last_customer_message_at?: string | null;
  window_end_at?: string | null;
}

export interface WhatsappWindowInfo {
  requires_template?: boolean;
  window_status?: WhatsappWindowStatus | null;
}

/** Per-org WhatsApp template settings (one kind: quote or update) as exposed over the API. */
export interface WhatsappTemplateSettings {
  templateName: string | null;
  templateLanguage: string | null;
  channelId: string | null;
  variables: Record<string, WhatsappTemplateVariable>;
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

export type TemplateRecipient = Pick<SendTemplateRequest, "contact_id" | "conversation_id" | "whatsapp_id">;
export type TemplateSettingsKind = "quote" | "update";
