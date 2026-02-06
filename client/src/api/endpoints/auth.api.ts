import axiosClient from "../client/axios-client";
import type { AuthUser } from "@/types/auth";

export const authApi = {
  getCurrentUser: async (): Promise<AuthUser | null> => {
    try {
      const { data } = await axiosClient.get<AuthUser>("/api/auth/user");
      return data;
    } catch {
      return null;
    }
  },

  logout: (): void => {
    window.location.href = "/api/logout";
  },
};
