export interface ChannelHealthIntegration {
  id: string;
  name: string;
  channel_type: string;
  integration_type: string | null;
  connection_status: string;
  last_error: string | null;
  last_error_at: string | null;
  email_address: string | null;
}

export interface ChannelHealth {
  has_errors: boolean;
  error_count: number;
  integrations: ChannelHealthIntegration[];
}

export interface DelegateConnectInput {
  email: string;
  channel_types: string[];
  recipient_name?: string;
  note?: string;
  expires_in_hours?: number;
}

export interface DelegateConnectResult {
  success: boolean;
  token_id: string;
  connect_url: string;
  expires_at: string;
  email_sent: boolean;
  sent_to: string;
}

export type ChannelStatusKind = "connected" | "setup_incomplete" | "needs_reconnect" | "inactive";

export interface ChannelWorkspaceStatus {
  provisioned: boolean;
}

export type WaTemplateStatus = "PENDING" | "APPROVED" | "REJECTED" | "PAUSED" | "DISABLED";
export type WaTemplateCategory = "MARKETING" | "UTILITY";

export interface WaTemplateButton {
  type: "URL" | "QUICK_REPLY" | "PHONE_NUMBER";
  text: string;
  url?: string;
  phone_number?: string;
}

export interface WaTemplate {
  id: string;
  channel_id: string;
  name: string;
  language: string;
  category: string;
  header_type: string | null;
  header_text: string | null;
  body_text: string;
  footer_text: string | null;
  buttons: WaTemplateButton[] | null;
  status: WaTemplateStatus;
  quality_score: string | null;
  parameter_format: "positional" | "named";
  last_synced_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface WaTemplateList {
  templates: WaTemplate[];
  total: number;
}

export interface WaTemplateSyncResult {
  synced: number;
  added: number;
  updated: number;
  removed: number;
  errors: string[];
}

export interface CreateWaTemplateInput {
  channel_id: string;
  name: string;
  category: WaTemplateCategory;
  language: string;
  header_text?: string;
  body_text: string;
  body_examples: string[];
  footer_text?: string;
  buttons?: WaTemplateButton[];
}

export interface CreateWaTemplateResult {
  id: string | null;
  template_id: string | null;
  status: string | null;
}

export type TemplateVariableSource =
  | "client_first_name" | "agent_name" | "agency_name" | "quote_link" | "sign_in_link" | "message" | "custom"
  | "destination" | "booking_reference" | "departure_date" | "portal_link" | "balance_due_date";

export interface TemplateVariableMapping {
  source: TemplateVariableSource;
  text?: string;
}

export interface TemplateSettings {
  templateName: string | null;
  templateLanguage: string | null;
  channelId: string | null;
  variables: Record<string, TemplateVariableMapping>;
}

/** Which org-level template a card or mapping is for ("auto" = one of the automatic customer messages). */
export type TemplateKind = "quote" | "update" | "pinReset" | "auto";

export type QuoteVariableSource = TemplateVariableSource;
export type QuoteVariableMapping = TemplateVariableMapping;
export type QuoteTemplateSettings = TemplateSettings;
/** The "General update" template agents use once a client's 24-hour window has closed. */
export type UpdateTemplateSettings = TemplateSettings;

/** How automatic customer messages go out, agency-wide. */
export type AutoChannel = "whatsapp" | "sms";

export type AutoMessagePurpose = "booking_confirmation" | "portal_ready" | "balance_reminder" | "departure_reminder";

export type ReadinessReason =
  | "switched_off" | "not_connected" | "no_channel" | "no_template" | "sms_not_configured" | "unreachable"
  | "org_suspended" | "database_update_needed" | "template_missing" | "template_not_approved" | "mapping_mismatch";

export interface PurposeReadiness {
  purpose: AutoMessagePurpose | "portal_sign_in";
  switchedOn: boolean;
  /** A text message row exists for this type, so the switch has something to turn on. */
  hasSwitch: boolean;
  channel: AutoChannel;
  ready: boolean;
  reason: ReadinessReason | null;
  note?: "no_template_outside_window";
}

export interface CustomerMessagingReadiness {
  autoChannel: AutoChannel;
  purposes: PurposeReadiness[];
}
