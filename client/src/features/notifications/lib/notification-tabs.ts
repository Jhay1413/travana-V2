import type { Notification } from "../types";

export type NotificationTab = "unread" | "read";

export interface PartitionedNotifications {
  unread: Notification[];
  read: Notification[];
}

/** Splits the feed into the Unread and Read tabs, keeping the incoming (newest-first) order. */
export function partitionNotifications(notifications: readonly Notification[]): PartitionedNotifications {
  const unread: Notification[] = [];
  const read: Notification[] = [];
  for (const n of notifications) (n.read ? read : unread).push(n);
  return { unread, read };
}

/** Returns a copy of the list with one notification marked read (used for the optimistic update). */
export function markNotificationReadInList(notifications: readonly Notification[], id: string): Notification[] {
  return notifications.map((n) => (n.id === id ? { ...n, read: true } : n));
}

export function markAllReadInList(notifications: readonly Notification[]): Notification[] {
  return notifications.map((n) => (n.read ? n : { ...n, read: true }));
}
