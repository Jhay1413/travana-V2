import axiosClient from "@/api/client/axios-client";
import type { Notification } from "../types";

// Server resolves the current user from the session — no userId in the URL.
export const notificationApi = {
  getAll: async (): Promise<Notification[]> => {
    const { data } = await axiosClient.get<Notification[]>(`/api/v2/notifications`);
    return data;
  },

  getUnread: async (): Promise<Notification[]> => {
    const { data } = await axiosClient.get<Notification[]>(`/api/v2/notifications/unread`);
    return data;
  },

  markRead: async (id: string): Promise<Notification> => {
    const { data } = await axiosClient.put<Notification>(`/api/v2/notifications/${id}/read`);
    return data;
  },

  markAllRead: async (): Promise<void> => {
    await axiosClient.put(`/api/v2/notifications/read-all`);
  },

  delete: async (id: string): Promise<void> => {
    await axiosClient.delete(`/api/v2/notifications/${id}`);
  },
};
