import axiosClient from "@/api/client/axios-client";
import type { ClientFile } from "@shared/schema";

export const clientFileApi = {
  getByClient: async (clientId: string): Promise<ClientFile[]> => {
    const { data } = await axiosClient.get<ClientFile[]>(`/api/v2/client-files/client/${clientId}`);
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
      `/api/v2/client-files/client/${clientId}`,
      formData,
      { headers: { "Content-Type": "multipart/form-data" } }
    );
    return data;
  },

  delete: async (id: string): Promise<void> => {
    await axiosClient.delete(`/api/v2/client-files/${id}`);
  },

  getDownloadUrl: (id: string): string => {
    return `/api/v2/client-files/${id}/download`;
  },

  // Same endpoint served with an "inline" disposition so the browser renders the
  // file in a preview (image/PDF) instead of downloading it.
  getPreviewUrl: (id: string): string => {
    return `/api/v2/client-files/${id}/download?inline=1`;
  },
};
