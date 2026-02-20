import { Router } from "express";
import { chatController } from "../controllers/chat.controller";

const router = Router();

router.get("/conversations", chatController.getConversations);
router.get("/conversations/:conversationId/messages", chatController.getMessages);
router.post("/conversations/:conversationId/messages", chatController.sendMessage);
router.post("/conversations/:conversationId/read", chatController.markRead);
router.post("/direct", chatController.startDirectChat);
router.post("/group", chatController.createGroupChat);

export default router;
