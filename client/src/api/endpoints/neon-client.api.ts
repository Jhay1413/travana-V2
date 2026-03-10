import axiosClient from "../client/axios-client";
import type { NeonClient, NeonClientImportRow, ImportResult, PaginatedNeonClients } from "@/types/neon-client";

export const neonClientApi = {
  getAll: async (params?: { page?: number; limit?: number; search?: string }): Promise<PaginatedNeonClients> => {
    const { data } = await axiosClient.get<PaginatedNeonClients>("/api/neon-clients", { params });
    return data;
  },

  getById: async (id: string): Promise<NeonClient> => {
    const { data } = await axiosClient.get<NeonClient>(`/api/neon-clients/${id}`);
    return data;
  },

  updateClient: async (id: string, updates: Partial<NeonClient>): Promise<NeonClient> => {
    const { data } = await axiosClient.patch<NeonClient>(`/api/neon-clients/${id}`, updates);
    return data;
  },

  create: async (clientData: Partial<NeonClient>): Promise<NeonClient> => {
    const { data } = await axiosClient.post<NeonClient>("/api/neon-clients", clientData);
    return data;
  },

  importClients: async (clients: NeonClientImportRow[]): Promise<ImportResult> => {
    const { data } = await axiosClient.post<ImportResult>("/api/neon-clients/import", { clients });
    return data;
  },
};
