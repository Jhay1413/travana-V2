import { useQuery } from "@tanstack/react-query";
import { notificationApi } from "@/api";
import type { Notification } from "@/types/notification";

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
    refetchInterval: 30000,
  });
}

export function useUnreadNotifications(userId: string) {
  return useQuery<Notification[]>({
    queryKey: notificationKeys.unread(userId),
    queryFn: () => notificationApi.getUnread(),
    enabled: !!userId,
    refetchInterval: 30000,
  });
}
