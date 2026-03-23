import { Router } from "express";
import { facebookController } from "../controllers/facebook.controller";

const router = Router();

// OAuth
router.get("/auth", facebookController.auth);
router.get("/callback", facebookController.callback);

// Webhook (no auth middleware — Facebook calls these directly)
router.get("/webhook", facebookController.verifyWebhook);
router.post("/webhook", facebookController.receiveWebhook);

// Pages
router.get("/pages", facebookController.getPages);
router.delete("/pages/:id", facebookController.disconnectPage);

// Conversations & messages
router.get("/pages/:id/conversations", facebookController.getConversations);
router.get("/conversations/:conversationId/messages", facebookController.getMessages);
router.post("/pages/:id/send", facebookController.sendMessage);

export default router;
