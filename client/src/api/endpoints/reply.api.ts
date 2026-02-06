import axiosClient from "../client/axios-client";
import type { TicketReply, CreateReplyData } from "@/types/reply";

export const replyApi = {
  getByTicket: async (ticketId: string): Promise<TicketReply[]> => {
    const { data } = await axiosClient.get<TicketReply[]>(`/api/replies/ticket/${ticketId}`);
    return data;
  },

  create: async (ticketId: string, replyData: CreateReplyData): Promise<TicketReply> => {
    const { data } = await axiosClient.post<TicketReply>(`/api/replies/ticket/${ticketId}`, {
      userId: replyData.userId,
      content: replyData.content,
      parentReplyId: replyData.parentReplyId || null,
    });
    return data;
  },

  update: async (id: string, content: string): Promise<TicketReply> => {
    const { data } = await axiosClient.put<TicketReply>(`/api/replies/${id}`, { content });
    return data;
  },

  delete: async (id: string): Promise<void> => {
    await axiosClient.delete(`/api/replies/${id}`);
  },
};
