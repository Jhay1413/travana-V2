import { Request, Response } from "express";
import { notificationService } from "./notification.service";
import { successResponse } from "../../utils/response";
import { asyncHandler } from "../../utils/async-handler";
import { AppError } from "../../utils/error-handler";

export const notificationController = {
  listByUserId: asyncHandler(async (req: Request, res: Response) => {
    const userId = req.query.userId as string | undefined;
    if (!userId) {
      throw new AppError("userId query parameter is required", 400);
    }
    const notifications = await notificationService.listByUserId(userId);
    return successResponse(res, notifications, "Notifications retrieved successfully");
  }),

  listUnreadByUserId: asyncHandler(async (req: Request, res: Response) => {
    const userId = req.query.userId as string | undefined;
    if (!userId) {
      throw new AppError("userId query parameter is required", 400);
    }
    const notifications = await notificationService.listUnreadByUserId(userId);
    return successResponse(res, notifications, "Unread notifications retrieved successfully");
  }),

  markRead: asyncHandler(async (req: Request, res: Response) => {
    const id = req.params.id as string;
    const notification = await notificationService.markRead(id);
    return successResponse(res, notification, "Notification marked as read");
  }),

  markAllRead: asyncHandler(async (req: Request, res: Response) => {
    const userId = req.query.userId as string | undefined;
    if (!userId) {
      throw new AppError("userId query parameter is required", 400);
    }
    await notificationService.markAllRead(userId);
    return successResponse(res, null, "All notifications marked as read");
  }),

  deleteNotification: asyncHandler(async (req: Request, res: Response) => {
    const id = req.params.id as string;
    await notificationService.deleteNotification(id);
    res.status(204).send();
  }),
};
