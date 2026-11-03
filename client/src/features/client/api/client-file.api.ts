import axiosClient from "@/api/client/axios-client";
import { CLIENT_FILE_ENDPOINTS } from "@/api/endpoints";
import type { ClientFile } from "@shared/schema";
import type { ClientFileItem } from "@/features/client/types/client-file.types";

export const clientFileApi = {
  getByClient: async (clientId: string): Promise<ClientFileItem[]> => {
    const { data } = await axiosClient.get<ClientFileItem[]>(CLIENT_FILE_ENDPOINTS.byClient(clientId));
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
      CLIENT_FILE_ENDPOINTS.byClient(clientId),
      formData,
      { headers: { "Content-Type": "multipart/form-data" } }
    );
    return data;
  },

  delete: async (id: string): Promise<void> => {
    await axiosClient.delete(CLIENT_FILE_ENDPOINTS.byId(id));
  },

  getDownloadUrl: (id: string): string => {
    return CLIENT_FILE_ENDPOINTS.download(id);
  },

  // Same endpoint served with an "inline" disposition so the browser renders the
  // file in a preview (image/PDF) instead of downloading it.
  getPreviewUrl: (id: string): string => {
    return CLIENT_FILE_ENDPOINTS.preview(id);
  },
};
