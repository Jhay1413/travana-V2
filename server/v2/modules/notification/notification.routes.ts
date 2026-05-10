import { Router } from "express";
import { notificationController } from "./notification.controller";

const router = Router();

router.get("/", notificationController.listByUserId);
router.get("/unread", notificationController.listUnreadByUserId);
router.put("/:id/read", notificationController.markRead);
router.put("/read-all", notificationController.markAllRead);
router.delete("/:id", notificationController.deleteNotification);

export default router;
