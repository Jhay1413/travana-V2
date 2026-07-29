import axiosClient from "@/api/client/axios-client";
import type { NeonClient } from "@/features/client/types/neon-client";

// Links a SendSeven inbox contact to a CRM client (client_table). Server module:
// server/v2/modules/contact-link. The axios interceptor unwraps the envelope.

export interface ContactLinkStatus {
  contactId: string;
  linkedClient: NeonClient | null;
  suggestions: NeonClient[];
}

// Reverse view: which SendSeven contact a CRM client is linked to (drives the
// client dashboard's Chats tab).
export interface ClientContactLink {
  clientId: string;
  contactId: string | null;
  linkedAt: string | null;
}

export interface CreateClientForContactInput {
  title?: string | null;
  firstName: string;
  surename: string;
  phoneNumber: string;
  email?: string | null;
}

const base = (contactId: string) => `/api/v2/contact-links/${encodeURIComponent(contactId)}`;

export const contactLinkApi = {
  getStatus: async (contactId: string, match?: { phone?: string; email?: string }): Promise<ContactLinkStatus> => {
    const { data } = await axiosClient.get<ContactLinkStatus>(base(contactId), {
      params: { phone: match?.phone, email: match?.email },
    });
    return data;
  },
  getByClient: async (clientId: string): Promise<ClientContactLink> => {
    const { data } = await axiosClient.get<ClientContactLink>(
      `/api/v2/contact-links/by-client/${encodeURIComponent(clientId)}`,
    );
    return data;
  },
  link: async (contactId: string, clientId: string): Promise<NeonClient> => {
    const { data } = await axiosClient.put<NeonClient>(base(contactId), { clientId });
    return data;
  },
  createAndLink: async (contactId: string, input: CreateClientForContactInput): Promise<NeonClient> => {
    const { data } = await axiosClient.post<NeonClient>(`${base(contactId)}/client`, input);
    return data;
  },
  unlink: async (contactId: string): Promise<{ ok: boolean }> => {
    const { data } = await axiosClient.delete<{ ok: boolean }>(base(contactId));
    return data;
  },
};
