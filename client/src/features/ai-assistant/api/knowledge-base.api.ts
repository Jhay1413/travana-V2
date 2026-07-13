import axiosClient from "@/api/client/axios-client";
import type { KbEntry, KbEntryCreatePayload, KbEntryUpdatePayload } from "../types";

export const knowledgeBaseApi = {
  getAll: async (): Promise<KbEntry[]> => {
    const { data } = await axiosClient.get<KbEntry[]>("/api/v2/knowledge-base");
    return data;
  },

  create: async (payload: KbEntryCreatePayload): Promise<KbEntry> => {
    const { data } = await axiosClient.post<KbEntry>("/api/v2/knowledge-base", payload);
    return data;
  },

  update: async (id: string, payload: KbEntryUpdatePayload): Promise<KbEntry> => {
    const { data } = await axiosClient.put<KbEntry>(`/api/v2/knowledge-base/${id}`, payload);
    return data;
  },

  delete: async (id: string): Promise<{ ok: true }> => {
    const { data } = await axiosClient.delete<{ ok: true }>(`/api/v2/knowledge-base/${id}`);
    return data;
  },
};
