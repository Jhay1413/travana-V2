import axiosClient from "../client/axios-client";
import type { Note } from "@shared/schema";

export type CreateNoteData = {
  quoteId: string;
  content: string;
  authorName: string;
  parentId?: string | null;
};

export const noteApi = {
  getByQuote: async (quoteId: string): Promise<Note[]> => {
    const { data } = await axiosClient.get<Note[]>(`/api/notes/quote/${quoteId}`);
    return data;
  },

  create: async (noteData: CreateNoteData): Promise<Note> => {
    const { data } = await axiosClient.post<Note>("/api/notes", noteData);
    return data;
  },

  update: async (id: string, content: string): Promise<Note> => {
    const { data } = await axiosClient.patch<Note>(`/api/notes/${id}`, { content });
    return data;
  },

  delete: async (id: string): Promise<void> => {
    await axiosClient.delete(`/api/notes/${id}`);
  },
};
