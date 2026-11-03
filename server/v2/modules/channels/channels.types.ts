// SendSeven's connect-token flow only accepts these types (SMS/email are
// provisioned via other flows) — filtering avoids opaque 422s.
export const CONNECTABLE_TYPES: ReadonlySet<string> = new Set(["whatsapp", "messenger", "instagram", "telegram", "gmail"]);

// SendSeven channel shapes used by the proxy. The tenant connects their own
// channels (WhatsApp/Messenger/Instagram/…) via a hosted connect page.

export interface SsChannel {
  id: string;
  tenant_id?: string;
  channel_type: string;
  name?: string | null;
  identifier?: string | null;
  phone_number_formatted?: string | null;
  is_active?: boolean;
  is_verified?: boolean;
  is_coexistence?: boolean;
  created_at?: string;
  activation_status?: string | null;
  setup_pending_reason?: string | null;
  avatar_url?: string | null;
  [key: string]: unknown;
}

export interface SsChannelTypeInfo {
  value: string;
  display_name: string;
  is_available: boolean;
}

export interface SsChannelTypes {
  available: string[];
  coming_soon: string[];
  all_types: SsChannelTypeInfo[];
}

export interface ConnectTokenCreate {
  name?: string | null;
  allowed_channel_types: string[];
  expires_in_hours?: number;
  max_uses?: number;
  use_window_minutes?: number;
  partner_name?: string | null;
  partner_redirect_url?: string | null;
}

export interface ConnectTokenResponse {
  id: string;
  connect_url: string;
  token: string;
  expires_at: string;
  allowed_channel_types: string[];
  [key: string]: unknown;
}

export interface SsChannelHealthIntegration {
  id: string;
  name: string;
  channel_type: string;
  integration_type: string | null;
  connection_status: string;
  last_error: string | null;
  last_error_at: string | null;
  email_address: string | null;
}

export interface SsChannelHealth {
  has_errors: boolean;
  error_count: number;
  integrations: SsChannelHealthIntegration[];
}

export interface DelegateConnectCreate {
  email: string;
  channel_types: string[];
  recipient_name?: string | null;
  note?: string | null;
  expires_in_hours?: number;
}

export interface DelegateConnectResponse {
  success: boolean;
  token_id: string;
  connect_url: string;
  expires_at: string;
  email_sent: boolean;
  sent_to: string;
}
