import axiosClient from "../client/axios-client";
import type { TransactionNote } from "@/types/quote";

export type CreateNoteData = {
  transaction_id?: string;
  client_id?: string;
  content: string;
  description?: string;
};

export const noteApi = {
  getByTransaction: async (transactionId: string): Promise<TransactionNote[]> => {
    const { data } = await axiosClient.get<TransactionNote[]>(`/api/v2/notes/transaction/${transactionId}`);
    return data;
  },

  getByClient: async (clientId: string): Promise<TransactionNote[]> => {
    const { data } = await axiosClient.get<TransactionNote[]>(`/api/v2/notes/client/${clientId}`);
    return data;
  },

  create: async (noteData: CreateNoteData): Promise<TransactionNote> => {
    const { data } = await axiosClient.post<TransactionNote>("/api/v2/notes", noteData);
    return data;
  },

  update: async (id: string, content: string): Promise<TransactionNote> => {
    const { data } = await axiosClient.patch<TransactionNote>(`/api/v2/notes/${id}`, { content });
    return data;
  },

  delete: async (id: string): Promise<void> => {
    await axiosClient.delete(`/api/v2/notes/${id}`);
  },
};
