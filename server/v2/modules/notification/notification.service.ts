import { notificationRepository } from "./notification.repository";
import { AppError } from "../../utils/error-handler";
import { taskRepository } from "../task/task.repository";
import { checkStaleTickets } from "../ticket/ticket-notification.service";
import type { Notification } from "@shared/schema";

// Replaces the node-cron sweep that used to run every 30 minutes in
// server/v2/index.ts (checkAndNotifyDueTasks + checkStaleTickets). That cron
// woke the (Neon, scale-to-zero) database on a fixed schedule regardless of
// whether anyone was using the app. Instead, these checks now run on demand,
// scoped to the requesting user, the first time that user loads their
// notifications (login or page refresh) in a given throttle window — see
// `runDueChecksForUser` below.
//
// 5 minutes: short enough that a newly-due task/stale ticket shows up on the
// next reasonable reload, long enough that the panel's refetch-on-window-focus
// (and any polling) can't turn "check on every notification fetch" into
// something more expensive than the cron it replaces.
const CHECK_THROTTLE_MS = 5 * 60 * 1000;

// Per-process, in-memory only: resets on deploy/restart. That's acceptable
// because both checks are idempotent — checkAndNotifyDueTasks only notifies
// tasks with notified=false and then flips the flag (task.repository.ts),
// and checkStaleTickets dedupes against existing notifications by
// type+link — so a check that reruns after a restart just does a cheap,
// scoped no-op query instead of double-notifying.
const lastCheckedAt = new Map<string, number>();

async function runDueChecksForUser(userId: string): Promise<void> {
  const last = lastCheckedAt.get(userId) ?? 0;
  if (Date.now() - last < CHECK_THROTTLE_MS) return;
  lastCheckedAt.set(userId, Date.now());

  // Scoped to this user (not a global scan), so this stays cheap enough to
  // await before the read below rather than firing-and-forgetting it.
  try {
    await taskRepository.checkAndNotifyDueTasks(userId);
  } catch (err) {
    console.error("Task notification check failed:", err);
  }
  try {
    await checkStaleTickets(userId);
  } catch (err) {
    console.error("Ticket notification check failed:", err);
  }
}

export const notificationService = {
  async listByUserId(userId: string): Promise<Notification[]> {
    await runDueChecksForUser(userId);
    return await notificationRepository.findByUserId(userId);
  },

  async listUnreadByUserId(userId: string): Promise<Notification[]> {
    await runDueChecksForUser(userId);
    return await notificationRepository.findUnreadByUserId(userId);
  },

  async markRead(id: string): Promise<Notification> {
    const notification = await notificationRepository.markRead(id);
    if (!notification) {
      throw new AppError("Notification not found", 404);
    }
    return notification;
  },

  async markAllRead(userId: string): Promise<void> {
    await notificationRepository.markAllRead(userId);
  },

  async deleteNotification(id: string): Promise<void> {
    await notificationRepository.remove(id);
  },

  async clearAll(userId: string): Promise<void> {
    await notificationRepository.removeAllByUserId(userId);
  },
};
