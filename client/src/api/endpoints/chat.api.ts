import axiosClient from "../client/axios-client";
import type { ChatConversation, ChatMessage } from "@/types/chat";

export const chatApi = {
  getConversations: async (): Promise<ChatConversation[]> => {
    const { data } = await axiosClient.get<ChatConversation[]>("/api/chat/conversations");
    return data;
  },

  getMessages: async (conversationId: string): Promise<ChatMessage[]> => {
    const { data } = await axiosClient.get<ChatMessage[]>(`/api/chat/conversations/${conversationId}/messages`);
    return data;
  },

  sendMessage: async (conversationId: string, content: string): Promise<ChatMessage> => {
    const { data } = await axiosClient.post<ChatMessage>(`/api/chat/conversations/${conversationId}/messages`, { content });
    return data;
  },

  sendMessageWithFile: async (conversationId: string, content: string, file: File): Promise<ChatMessage> => {
    const formData = new FormData();
    formData.append("content", content);
    formData.append("file", file);
    const { data } = await axiosClient.post<ChatMessage>(
      `/api/chat/conversations/${conversationId}/messages/upload`,
      formData,
      { headers: { "Content-Type": "multipart/form-data" } }
    );
    return data;
  },

  startDirectChat: async (targetUserId: string): Promise<{ conversationId: string }> => {
    const { data } = await axiosClient.post<{ conversationId: string }>("/api/chat/direct", { targetUserId });
    return data;
  },

  createGroupChat: async (name: string, participantIds: string[]): Promise<ChatConversation> => {
    const { data } = await axiosClient.post<ChatConversation>("/api/chat/group", { name, participantIds });
    return data;
  },

  markRead: async (conversationId: string): Promise<void> => {
    await axiosClient.post(`/api/chat/conversations/${conversationId}/read`);
  },
};
