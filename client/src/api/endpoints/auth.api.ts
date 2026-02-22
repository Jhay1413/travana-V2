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

  login: async (email: string, password: string): Promise<AuthUser> => {
    const { data } = await axiosClient.post<AuthUser>("/api/auth/login", { email, password });
    return data;
  },

  logout: (): void => {
    window.location.href = "/api/logout";
  },
};
