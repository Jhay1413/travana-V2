import { Request, Response } from "express";
import { notificationService } from "./notification.service";
import { notificationRepository } from "./notification.repository";
import { successResponse } from "../../utils/response";
import { asyncHandler } from "../../utils/async-handler";
import { AppError } from "../../utils/error-handler";
import { getUserId } from "../../utils/get-user-id";

async function assertOwnership(id: string, userId: string) {
  const notification = await notificationRepository.findById(id);
  if (!notification || notification.userId !== userId) {
    throw new AppError("Notification not found", 404);
  }
  return notification;
}

function requireUserId(req: Request): string {
  const userId = getUserId(req);
  if (!userId) {
    throw new AppError("Unauthorized", 401);
  }
  return userId;
}

export const notificationController = {
  listByUserId: asyncHandler(async (req: Request, res: Response) => {
    const userId = requireUserId(req);
    const notifications = await notificationService.listByUserId(userId);
    return successResponse(res, notifications, "Notifications retrieved successfully");
  }),

  listUnreadByUserId: asyncHandler(async (req: Request, res: Response) => {
    const userId = requireUserId(req);
    const notifications = await notificationService.listUnreadByUserId(userId);
    return successResponse(res, notifications, "Unread notifications retrieved successfully");
  }),

  markRead: asyncHandler(async (req: Request, res: Response) => {
    const userId = requireUserId(req);
    const id = req.params.id as string;
    await assertOwnership(id, userId);
    const notification = await notificationService.markRead(id);
    return successResponse(res, notification, "Notification marked as read");
  }),

  markAllRead: asyncHandler(async (req: Request, res: Response) => {
    const userId = requireUserId(req);
    await notificationService.markAllRead(userId);
    return successResponse(res, null, "All notifications marked as read");
  }),

  deleteNotification: asyncHandler(async (req: Request, res: Response) => {
    const userId = requireUserId(req);
    const id = req.params.id as string;
    await assertOwnership(id, userId);
    await notificationService.deleteNotification(id);
    res.status(204).send();
  }),
};
