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
