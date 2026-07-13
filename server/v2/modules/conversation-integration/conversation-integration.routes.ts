import { Router } from "express";
import { conversationIntegrationController as c } from "./conversation-integration.controller";

// All routes are platform-admin-only (guarded where mounted) and target a
// specific tenant via :orgId.
const router = Router();

router.get("/", c.listStatuses);
router.get("/:orgId", c.getStatus);
router.put("/:orgId", c.setToken);
router.delete("/:orgId", c.remove);
router.post("/:orgId/test", c.test);
router.post("/:orgId/auto-reply", c.enableAutoReply);
router.delete("/:orgId/auto-reply", c.disableAutoReply);

export default router;
