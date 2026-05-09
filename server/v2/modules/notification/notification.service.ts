import { notificationRepository } from "./notification.repository";
import { AppError } from "../../utils/error-handler";
import type { Notification } from "@shared/schema";

export const notificationService = {
  async listByUserId(userId: string): Promise<Notification[]> {
    return await notificationRepository.findByUserId(userId);
  },

  async listUnreadByUserId(userId: string): Promise<Notification[]> {
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
};
