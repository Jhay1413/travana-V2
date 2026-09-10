import axiosClient from "@/api/client/axios-client";
import type { TicketReply, TicketReplyRow, CreateReplyData } from "../types";

export const replyApi = {
  getByTicket: async (ticketId: string): Promise<TicketReply[]> => {
    const { data } = await axiosClient.get<TicketReply[]>(`/api/v2/replies/ticket/${ticketId}`);
    return data;
  },

  // Create / update return the bare row; like counts only come with the list.
  create: async (ticketId: string, replyData: CreateReplyData): Promise<TicketReplyRow> => {
    const { data } = await axiosClient.post<TicketReplyRow>(`/api/v2/replies/ticket/${ticketId}`, {
      content: replyData.content,
      parentReplyId: replyData.parentReplyId || null,
    });
    return data;
  },

  update: async (id: string, content: string): Promise<TicketReplyRow> => {
    const { data } = await axiosClient.put<TicketReplyRow>(`/api/v2/replies/${id}`, { content });
    return data;
  },

  delete: async (id: string): Promise<void> => {
    await axiosClient.delete(`/api/v2/replies/${id}`);
  },

  toggleLike: async (id: string): Promise<{ liked: boolean; likeCount: number }> => {
    const { data } = await axiosClient.post<{ liked: boolean; likeCount: number }>(
      `/api/v2/replies/${id}/like`,
    );
    return data;
  },
};
