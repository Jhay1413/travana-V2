import axiosClient from "../client/axios-client";
import type { Notification } from "@/types/notification";

export const notificationApi = {
  getAll: async (userId: string): Promise<Notification[]> => {
    const { data } = await axiosClient.get<Notification[]>(`/api/v2/notifications?userId=${userId}`);
    return data;
  },

  getUnread: async (userId: string): Promise<Notification[]> => {
    const { data } = await axiosClient.get<Notification[]>(`/api/v2/notifications/unread?userId=${userId}`);
    return data;
  },

  markRead: async (id: string): Promise<Notification> => {
    const { data } = await axiosClient.put<Notification>(`/api/v2/notifications/${id}/read`);
    return data;
  },

  markAllRead: async (userId: string): Promise<void> => {
    await axiosClient.put(`/api/v2/notifications/read-all?userId=${userId}`);
  },

  delete: async (id: string): Promise<void> => {
    await axiosClient.delete(`/api/v2/notifications/${id}`);
  },
};
