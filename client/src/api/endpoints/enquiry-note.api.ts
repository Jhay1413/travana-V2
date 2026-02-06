import axiosClient from "../client/axios-client";
import type { EnquiryNote } from "@shared/schema";

export type CreateEnquiryNoteData = {
  enquiryId: string;
  content: string;
  authorName: string;
  parentId?: string | null;
};

export const enquiryNoteApi = {
  getByEnquiry: async (enquiryId: string): Promise<EnquiryNote[]> => {
    const { data } = await axiosClient.get<EnquiryNote[]>(`/api/enquiries/${enquiryId}/notes`);
    return data;
  },

  create: async (enquiryId: string, noteData: CreateEnquiryNoteData): Promise<EnquiryNote> => {
    const { data } = await axiosClient.post<EnquiryNote>(`/api/enquiries/${enquiryId}/notes`, noteData);
    return data;
  },

  update: async (enquiryId: string, id: string, content: string): Promise<EnquiryNote> => {
    const { data } = await axiosClient.patch<EnquiryNote>(`/api/enquiries/${enquiryId}/notes/${id}`, { content });
    return data;
  },

  delete: async (enquiryId: string, id: string): Promise<void> => {
    await axiosClient.delete(`/api/enquiries/${enquiryId}/notes/${id}`);
  },
};
