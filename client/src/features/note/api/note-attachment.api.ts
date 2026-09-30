import axiosClient from "@/api/client/axios-client";
import type { NoteAttachment } from "../types";

export const noteAttachmentApi = {
  getByTransaction: async (transactionId: string): Promise<NoteAttachment[]> => {
    const { data } = await axiosClient.get<NoteAttachment[]>(`/api/v2/note-attachments/transaction/${transactionId}`);
    return data;
  },

  upload: async (noteId: string, files: File[]): Promise<NoteAttachment[]> => {
    const formData = new FormData();
    for (const file of files) formData.append("files", file);
    const { data } = await axiosClient.post<NoteAttachment[]>(`/api/v2/note-attachments/note/${noteId}`, formData, {
      headers: { "Content-Type": "multipart/form-data" },
    });
    return data;
  },

  delete: async (id: string): Promise<void> => {
    await axiosClient.delete(`/api/v2/note-attachments/${id}`);
  },

  getDownloadUrl: (id: string): string => `/api/v2/note-attachments/${id}/download`,
};
