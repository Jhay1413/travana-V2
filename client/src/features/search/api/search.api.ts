import axiosClient from "@/api/client/axios-client";

export type GlobalSearchResponse = {
  clients: Array<{
    id: string;
    name: string;
    subtitle: string;
  }>;
  bookings: Array<{
    id: string;
    clientId: string | null;
    name: string;
    subtitle: string;
  }>;
  nextOffset: number | null;
};

export const searchApi = {
  globalSearch: async (q: string, offset = 0): Promise<GlobalSearchResponse> => {
    const { data } = await axiosClient.get<GlobalSearchResponse>("/api/v2/search", {
      params: { q, offset },
    });
    return data;
  },
};
