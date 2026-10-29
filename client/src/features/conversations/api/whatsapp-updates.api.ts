import axiosClient from "@/api/client/axios-client";

// General-update WhatsApp sends, proxied through our server at
// `/api/v2/whatsapp-updates`. The axios interceptor unwraps the envelope.
// The manager-only settings endpoints live in the integrations feature.

const BASE = "/api/v2/whatsapp-updates";

export interface UpdateTemplateStatus {
  configured: boolean;
  templateName: string | null;
  channelId: string | null;
}

export interface KnownWhatsappWindow {
  known: true;
  inWindow: boolean;
  requiresTemplate: boolean;
  remainingSeconds: number | null;
  windowEndAt: string | null;
  lastCustomerMessageAt: string | null;
}

export type WhatsappWindow = KnownWhatsappWindow | { known: false };

export interface WhatsappUpdateResult {
  conversationId: string;
  viaTemplate: boolean;
}

export const whatsappUpdatesApi = {
  getTemplate: async (): Promise<UpdateTemplateStatus> => {
    const { data } = await axiosClient.get<UpdateTemplateStatus>(`${BASE}/template`);
    return data;
  },
  getWindow: async (conversationId: string): Promise<WhatsappWindow> => {
    const { data } = await axiosClient.get<WhatsappWindow>(
      `${BASE}/conversations/${encodeURIComponent(conversationId)}/window`,
    );
    return data;
  },
  sendToConversation: async (conversationId: string, text: string): Promise<WhatsappUpdateResult> => {
    const { data } = await axiosClient.post<WhatsappUpdateResult>(
      `${BASE}/conversations/${encodeURIComponent(conversationId)}/send`,
      { text },
    );
    return data;
  },
  sendToClient: async (clientId: string, channelId: string, text: string): Promise<WhatsappUpdateResult> => {
    const { data } = await axiosClient.post<WhatsappUpdateResult>(
      `${BASE}/clients/${encodeURIComponent(clientId)}/send`,
      { channelId, text },
    );
    return data;
  },
};
