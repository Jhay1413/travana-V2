import axiosClient from "@/api/client/axios-client";
import type { Tag } from "@shared/schema";

export const tagApi = {
  getAll: async (): Promise<Tag[]> => {
    const { data } = await axiosClient.get<Tag[]>("/api/v2/tags");
    return data;
  },

  search: async (query: string): Promise<Tag[]> => {
    const { data } = await axiosClient.get<Tag[]>(
      `/api/v2/tags/search?q=${encodeURIComponent(query)}`,
    );
    return data;
  },

  /** Rename a tag entity (global — affects every quote/client/booking using it). */
  update: async (id: string, body: { name: string }): Promise<Tag> => {
    const { data } = await axiosClient.patch<Tag>(`/api/v2/settings/tags/${id}`, body);
    return data;
  },

  /** Delete a tag entity globally. Cascades: it is detached from all quotes/clients/bookings. */
  remove: async (id: string): Promise<void> => {
    await axiosClient.delete(`/api/v2/settings/tags/${id}`);
  },
};
