import axiosClient from "../client/axios-client";

export interface EmailAccountPublic {
  id: string;
  userId: string;
  label: string;
  emailAddress: string;
  imapHost: string;
  imapPort: number;
  smtpHost: string;
  smtpPort: number;
  secure: boolean;
  username: string;
  createdAt: string;
  updatedAt: string | null;
}

export interface ImapMessage {
  uid: number;
  subject: string | null;
  from: { name: string; address: string }[];
  to: { name: string; address: string }[];
  date: string | null;
  messageId: string | null;
  flags: string[];
}

export interface EmailAttachment {
  filename: string;
  contentType: string;
  size: number;
  content: string; // base64-encoded
}

export interface ImapMessageFull extends ImapMessage {
  html: string | null;
  text: string | null;
  attachments: EmailAttachment[];
}

export interface CreateEmailAccountData {
  userId: string;
  label: string;
  emailAddress: string;
  imapHost: string;
  imapPort: number;
  smtpHost: string;
  smtpPort: number;
  secure: boolean;
  username: string;
  password: string;
}

export interface SendEmailPayload {
  to: string;
  cc?: string;
  subject: string;
  html?: string;
  text?: string;
}

export const emailApi = {
  getSharedAccount: async (): Promise<EmailAccountPublic | null> => {
    const { data } = await axiosClient.get<EmailAccountPublic | null>("/api/emails/accounts/shared");
    return data;
  },

  listAccounts: async (userId: string): Promise<EmailAccountPublic[]> => {
    const { data } = await axiosClient.get<EmailAccountPublic[]>(`/api/emails/accounts/user/${userId}`);
    return data;
  },

  createAccount: async (payload: CreateEmailAccountData): Promise<EmailAccountPublic> => {
    const { data } = await axiosClient.post<EmailAccountPublic>("/api/emails/accounts", payload);
    return data;
  },

  deleteAccount: async (id: string): Promise<void> => {
    await axiosClient.delete(`/api/emails/accounts/${id}`);
  },

  testConnection: async (id: string): Promise<{ success: boolean; message: string }> => {
    const { data } = await axiosClient.get<{ success: boolean; message: string }>(`/api/emails/accounts/${id}/test`);
    return data;
  },

  fetchMessages: async (accountId: string, folder = "INBOX", limit = 50): Promise<ImapMessage[]> => {
    const { data } = await axiosClient.get<ImapMessage[]>(`/api/emails/accounts/${accountId}/messages`, {
      params: { folder, limit },
    });
    return data;
  },

  fetchMessageById: async (accountId: string, uid: number, folder = "INBOX"): Promise<ImapMessageFull> => {
    const { data } = await axiosClient.get<ImapMessageFull>(`/api/emails/accounts/${accountId}/messages/${uid}`, {
      params: { folder },
    });
    return data;
  },

  sendEmail: async (accountId: string, payload: SendEmailPayload): Promise<{ messageId: string }> => {
    const { data } = await axiosClient.post<{ messageId: string }>(`/api/emails/accounts/${accountId}/send`, payload);
    return data;
  },
};
