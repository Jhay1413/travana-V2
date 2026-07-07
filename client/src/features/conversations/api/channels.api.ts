import axiosClient from "@/api/client/axios-client";

// SendSeven channels for the logged-in org (proxied; uses the org's own token).

const BASE = "/api/v2/channels";

export interface SsChannel {
  id: string;
  channel_type: string;
  name?: string | null;
  identifier?: string | null;
  phone_number_formatted?: string | null;
  is_active?: boolean;
  is_verified?: boolean;
  is_coexistence?: boolean;
  created_at?: string;
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

export interface ConnectTokenInput {
  allowed_channel_types: string[];
  partner_redirect_url?: string;
  name?: string;
}

export interface ConnectTokenResult {
  id: string;
  connect_url: string;
  token: string;
  expires_at: string;
  allowed_channel_types: string[];
}

export const channelsApi = {
  list: async (): Promise<SsChannel[]> => {
    const { data } = await axiosClient.get<SsChannel[]>(BASE);
    return data;
  },
  types: async (): Promise<SsChannelTypes> => {
    const { data } = await axiosClient.get<SsChannelTypes>(`${BASE}/types`);
    return data;
  },
  createConnectToken: async (input: ConnectTokenInput): Promise<ConnectTokenResult> => {
    const { data } = await axiosClient.post<ConnectTokenResult>(`${BASE}/connect-token`, input);
    return data;
  },
  remove: async (channelId: string): Promise<{ ok: boolean }> => {
    const { data } = await axiosClient.delete<{ ok: boolean }>(`${BASE}/${channelId}`);
    return data;
  },
};
