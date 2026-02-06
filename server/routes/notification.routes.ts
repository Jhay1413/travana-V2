import { Router } from "express";
import { notificationController } from "../controllers/notification.controller";
import { validate } from "../middlewares/validation.middleware";
import { listNotificationsValidator } from "../validators/notification.validator";

const router = Router();

router.get("/", validate(listNotificationsValidator), notificationController.listByUserId);
router.get("/unread", validate(listNotificationsValidator), notificationController.listUnreadByUserId);
router.put("/:id/read", notificationController.markRead);
router.put("/read-all", notificationController.markAllRead);
router.delete("/:id", notificationController.deleteNotification);

export default router;
