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
