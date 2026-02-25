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

  changePassword: async (oldPassword: string, newPassword: string, confirmPassword: string): Promise<{ message: string }> => {
    const { data } = await axiosClient.post<{ message: string }>("/api/auth/change-password", {
      oldPassword,
      newPassword,
      confirmPassword,
    });
    return data;
  },

  updateProfile: async (profileData: { phoneNumber?: string; email?: string }): Promise<AuthUser> => {
    const { data } = await axiosClient.patch<AuthUser>("/api/auth/profile", profileData);
    return data;
  },

  uploadAvatar: async (file: File): Promise<AuthUser> => {
    const formData = new FormData();
    formData.append("avatar", file);
    const { data } = await axiosClient.post<AuthUser>("/api/auth/avatar", formData, {
      headers: { "Content-Type": "multipart/form-data" },
    });
    return data;
  },
};
