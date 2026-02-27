import axiosClient from "../client/axios-client";
import type { ClientFile } from "@shared/schema";

export const clientFileApi = {
  getByClient: async (clientId: string): Promise<ClientFile[]> => {
    const { data } = await axiosClient.get<ClientFile[]>(`/api/client-files/client/${clientId}`);
    return data;
  },

  upload: async (
    clientId: string,
    file: File,
    meta: { title?: string; category?: string; allocationType?: string; allocationId?: string }
  ): Promise<ClientFile> => {
    const formData = new FormData();
    formData.append("file", file);
    if (meta.title) formData.append("title", meta.title);
    if (meta.category) formData.append("category", meta.category);
    if (meta.allocationType) formData.append("allocationType", meta.allocationType);
    if (meta.allocationId) formData.append("allocationId", meta.allocationId);
    const { data } = await axiosClient.post<ClientFile>(
      `/api/client-files/client/${clientId}`,
      formData,
      { headers: { "Content-Type": "multipart/form-data" } }
    );
    return data;
  },

  delete: async (id: string): Promise<void> => {
    await axiosClient.delete(`/api/client-files/${id}`);
  },

  getDownloadUrl: (id: string): string => {
    return `/api/client-files/${id}/download`;
  },
};
