import { useMutation, useQueryClient, type QueryClient } from "@tanstack/react-query";
import { notificationApi } from "./notification.api";
import { notificationKeys } from "./use-notification-queries";
import type { Notification } from "../types";
import { markAllReadInList, markNotificationReadInList } from "../lib/notification-tabs";

type CacheSnapshot = Array<[readonly unknown[], Notification[] | undefined]>;

/**
 * Optimistically rewrites every cached notification list (the panel feed and the
 * unread list) and returns a snapshot to roll back to if the request fails.
 */
async function patchNotificationCaches(queryClient: QueryClient, patch: (list: Notification[]) => Notification[]): Promise<CacheSnapshot> {
  await queryClient.cancelQueries({ queryKey: notificationKeys.all });
  const entries = queryClient.getQueriesData<Notification[]>({ queryKey: notificationKeys.all });
  for (const [key, list] of entries) {
    if (!Array.isArray(list)) continue;
    const patched = patch(list);
    // The "unread" list only ever holds unread items, so read ones drop out of it.
    queryClient.setQueryData<Notification[]>(key, key[1] === "unread" ? patched.filter((n) => !n.read) : patched);
  }
  return entries;
}

function rollback(queryClient: QueryClient, snapshot: CacheSnapshot | undefined): void {
  snapshot?.forEach(([key, list]) => queryClient.setQueryData(key, list));
}

export function useMarkNotificationRead(userId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => notificationApi.markRead(id),
    onMutate: (id: string) => patchNotificationCaches(queryClient, (list) => markNotificationReadInList(list, id)),
    onError: (_err, _id, snapshot) => rollback(queryClient, snapshot),
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: notificationKeys.all });
    },
  });
}

export function useMarkAllNotificationsRead(userId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => notificationApi.markAllRead(),
    onMutate: () => patchNotificationCaches(queryClient, markAllReadInList),
    onError: (_err, _vars, snapshot) => rollback(queryClient, snapshot),
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: notificationKeys.all });
    },
  });
}

export function useDeleteNotification(userId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => notificationApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: notificationKeys.all });
    },
  });
}

export function useClearAllNotifications(userId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => notificationApi.clearAll(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: notificationKeys.all });
    },
  });
}
