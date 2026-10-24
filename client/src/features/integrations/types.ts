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
