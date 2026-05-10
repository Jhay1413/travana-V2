import axiosClient from "../client/axios-client";

export interface FacebookPagePublic {
  id: string;
  userId: string;
  pageId: string;
  pageName: string;
  pageCategory: string | null;
  pageAvatar: string | null;
  createdAt: string;
}

export interface FbConversation {
  id: string;
  participantId: string;
  participantName: string;
  lastMessage: string;
  updatedAt: string;
  unreadCount: number;
}

export interface FbMessage {
  id: string;
  text: string;
  senderId: string;
  senderName: string;
  senderType: "customer" | "agent";
  createdAt: string;
}

export const facebookApi = {
  getPages: async (userId: string): Promise<FacebookPagePublic[]> => {
    const { data } = await axiosClient.get<FacebookPagePublic[]>("/api/v2/facebook/pages", { params: { userId } });
    return data;
  },

  disconnectPage: async (pageId: string, userId: string): Promise<void> => {
    await axiosClient.delete(`/api/v2/facebook/pages/${pageId}`, { params: { userId } });
  },

  getConversations: async (pageId: string, userId: string): Promise<FbConversation[]> => {
    const { data } = await axiosClient.get<FbConversation[]>(`/api/v2/facebook/pages/${pageId}/conversations`, {
      params: { userId },
    });
    return data;
  },

  getMessages: async (conversationId: string, pageId: string, userId: string): Promise<FbMessage[]> => {
    const { data } = await axiosClient.get<FbMessage[]>(`/api/v2/facebook/conversations/${conversationId}/messages`, {
      params: { pageId, userId },
    });
    return data;
  },

  sendMessage: async (pageId: string, recipientId: string, text: string, userId: string): Promise<void> => {
    await axiosClient.post(`/api/v2/facebook/pages/${pageId}/send`, { recipientId, text }, { params: { userId } });
  },
};
