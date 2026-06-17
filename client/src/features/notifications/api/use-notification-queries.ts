import { useQuery } from "@tanstack/react-query";
import { notificationApi } from "./notification.api";
import type { Notification } from "../types";

export const notificationKeys = {
  all: ["notifications"] as const,
  byUser: (userId: string) => [...notificationKeys.all, userId] as const,
  unread: (userId: string) => [...notificationKeys.all, "unread", userId] as const,
};

export function useNotifications(userId: string) {
  return useQuery<Notification[]>({
    queryKey: notificationKeys.byUser(userId),
    queryFn: () => notificationApi.getAll(),
    enabled: !!userId,
    refetchOnWindowFocus: true,
  });
}

export function useUnreadNotifications(userId: string) {
  return useQuery<Notification[]>({
    queryKey: notificationKeys.unread(userId),
    queryFn: () => notificationApi.getUnread(),
    enabled: !!userId,
    refetchOnWindowFocus: true,
  });
}
