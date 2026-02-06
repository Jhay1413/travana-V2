import { useMutation, useQueryClient } from "@tanstack/react-query";
import { notificationApi } from "@/api";
import { notificationKeys } from "@/hooks/queries";

export function useMarkNotificationRead(userId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => notificationApi.markRead(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: notificationKeys.byUser(userId) });
    },
  });
}

export function useMarkAllNotificationsRead(userId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => notificationApi.markAllRead(userId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: notificationKeys.byUser(userId) });
    },
  });
}

export function useDeleteNotification(userId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => notificationApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: notificationKeys.byUser(userId) });
    },
  });
}
