import axiosClient from "@/api/client/axios-client";

export interface Favorite {
  id: string;
  userId: string;
  itemType: string;
  itemId: string;
  label: string;
  subtitle: string | null;
  displayOrder: number;
  createdAt: string;
  clientId?: string | null;
  clientName?: string | null;
}

export interface ToggleFavoritePayload {
  itemType: string;
  itemId: string;
  label: string;
  subtitle?: string;
}

export const favoriteApi = {
  getAll: async (): Promise<Favorite[]> => {
    const { data } = await axiosClient.get<Favorite[]>("/api/v2/favorites");
    return data;
  },
  add: async (payload: ToggleFavoritePayload): Promise<Favorite> => {
    const { data } = await axiosClient.post<Favorite>("/api/v2/favorites", payload);
    return data;
  },
  toggle: async (payload: ToggleFavoritePayload): Promise<{ favorited: boolean; favorite?: Favorite }> => {
    const { data } = await axiosClient.post<{ favorited: boolean; favorite?: Favorite }>("/api/v2/favorites/toggle", payload);
    return data;
  },
  check: async (itemType: string, itemId: string): Promise<{ favorited: boolean }> => {
    const { data } = await axiosClient.get<{ favorited: boolean }>(`/api/v2/favorites/check?itemType=${itemType}&itemId=${itemId}`);
    return data;
  },
  remove: async (id: string): Promise<void> => {
    await axiosClient.delete(`/api/v2/favorites/${id}`);
  },
};
