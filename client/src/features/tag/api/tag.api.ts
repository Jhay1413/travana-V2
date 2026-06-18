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
};
