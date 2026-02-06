import axiosClient from "../client/axios-client";
import type { User } from "@/types/user";

export const userApi = {
  getAll: async (): Promise<User[]> => {
    const { data } = await axiosClient.get<User[]>("/api/users");
    return data;
  },

  update: async (id: string, userData: Partial<User>): Promise<User> => {
    const { data } = await axiosClient.patch<User>(`/api/users/${id}`, userData);
    return data;
  },

  delete: async (id: string): Promise<void> => {
    await axiosClient.delete(`/api/users/${id}`);
  },
};
