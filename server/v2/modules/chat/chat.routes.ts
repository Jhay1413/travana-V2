import { Router } from "express";
import multer from "multer";
import { chatController } from "./chat.controller";

const router = Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
});

router.get("/conversations", chatController.getConversations);
router.get("/conversations/:conversationId/messages", chatController.getMessages);
router.post("/conversations/:conversationId/messages", chatController.sendMessage);
router.post("/conversations/:conversationId/messages/upload", upload.single("file"), chatController.sendMessageWithFile);
router.post("/conversations/:conversationId/read", chatController.markRead);
router.post("/direct", chatController.startDirectChat);
router.post("/group", chatController.createGroupChat);
router.get("/files/:filename", chatController.serveFile);

export default router;
