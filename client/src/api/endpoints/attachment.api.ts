import axiosClient from "../client/axios-client";
import type { TicketAttachment } from "@/types/attachment";

export const attachmentApi = {
  getByTicket: async (ticketId: string): Promise<TicketAttachment[]> => {
    const { data } = await axiosClient.get<TicketAttachment[]>(`/api/v2/attachments/ticket/${ticketId}`);
    return data;
  },

  upload: async (ticketId: string, file: File): Promise<TicketAttachment> => {
    const formData = new FormData();
    formData.append("file", file);
    const { data } = await axiosClient.post<TicketAttachment>(
      `/api/v2/attachments/ticket/${ticketId}`,
      formData,
      { headers: { "Content-Type": "multipart/form-data" } },
    );
    return data;
  },

  delete: async (id: string): Promise<void> => {
    await axiosClient.delete(`/api/v2/attachments/${id}`);
  },

  getDownloadUrl: (id: string): string => {
    return `/api/v2/attachments/${id}/download`;
  },
};
