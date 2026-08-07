import axiosClient from "@/api/client/axios-client";
import type {
  NeonClient,
  NeonClientImportRow,
  ImportResult,
  PaginatedNeonClients,
  PaginatedDuplicatePhoneGroups,
  DuplicatePhoneGroupDetail,
  MergeDuplicatesResult,
} from "@/features/client/types/neon-client";

export const neonClientApi = {
  getAll: async (params?: { page?: number; limit?: number; search?: string }): Promise<PaginatedNeonClients> => {
    const { data } = await axiosClient.get<PaginatedNeonClients>("/api/v2/neon-clients", { params });
    return data;
  },

  getById: async (id: string): Promise<NeonClient> => {
    const { data } = await axiosClient.get<NeonClient>(`/api/v2/neon-clients/${id}`);
    return data;
  },

  updateClient: async (id: string, updates: Partial<NeonClient>): Promise<NeonClient> => {
    const { data } = await axiosClient.patch<NeonClient>(`/api/v2/neon-clients/${id}`, updates);
    return data;
  },

  create: async (clientData: Partial<NeonClient>): Promise<NeonClient> => {
    const { data } = await axiosClient.post<NeonClient>("/api/v2/neon-clients", clientData);
    return data;
  },

  importClients: async (clients: NeonClientImportRow[]): Promise<ImportResult> => {
    const { data } = await axiosClient.post<ImportResult>("/api/v2/neon-clients/import", { clients });
    return data;
  },

  // Merge a duplicate (source) client into a surviving (target) client. Returns
  // the surviving client; the source is soft-archived server-side.
  merge: async (sourceId: string, targetId: string): Promise<NeonClient> => {
    const { data } = await axiosClient.post<NeonClient>(`/api/v2/neon-clients/${sourceId}/merge`, { targetId });
    return data;
  },

  // Phone numbers held by more than one active client, one row per number.
  getDuplicatePhoneGroups: async (params?: {
    page?: number;
    limit?: number;
    search?: string;
  }): Promise<PaginatedDuplicatePhoneGroups> => {
    const { data } = await axiosClient.get<PaginatedDuplicatePhoneGroups>(
      "/api/v2/neon-clients/duplicates/phone",
      { params },
    );
    return data;
  },

  getDuplicatePhoneGroup: async (phoneKey: string): Promise<DuplicatePhoneGroupDetail> => {
    const { data } = await axiosClient.get<DuplicatePhoneGroupDetail>(
      `/api/v2/neon-clients/duplicates/phone/${phoneKey}`,
    );
    return data;
  },

  // Fold a whole duplicate group into one survivor. `targetId` is the main
  // client the user chose to keep; every id in `sourceIds` is archived into it.
  mergeDuplicates: async (targetId: string, sourceIds: string[]): Promise<MergeDuplicatesResult> => {
    const { data } = await axiosClient.post<MergeDuplicatesResult>(
      `/api/v2/neon-clients/${targetId}/merge-duplicates`,
      { sourceIds },
    );
    return data;
  },
};
