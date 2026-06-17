import axiosClient from "@/api/client/axios-client";
import type { User } from "../types";

export const userApi = {
  getAll: async (params?: { salesAgentsOnly?: boolean }): Promise<User[]> => {
    const { data } = await axiosClient.get<User[]>("/api/v2/users", {
      params: params?.salesAgentsOnly ? { salesAgentsOnly: true } : undefined,
    });
    return data;
  },

  create: async (userData: Record<string, unknown>): Promise<User> => {
    const { data } = await axiosClient.post<User>("/api/v2/users", userData);
    return data;
  },

  update: async (id: string, userData: Partial<User>): Promise<User> => {
    const { data } = await axiosClient.patch<User>(`/api/v2/users/${id}`, userData);
    return data;
  },

  delete: async (id: string): Promise<void> => {
    await axiosClient.delete(`/api/v2/users/${id}`);
  },
};
