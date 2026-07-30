import { Router } from "express";
import { validate } from "../../middlewares/validation.middleware";
import { requireOrgRole } from "../../middlewares/auth/require-org-role";
import { botConfigController as c } from "./bot-config.controller";
import { updateBotConfigValidator, enableBotValidator, setModeValidator } from "./bot-config.validator";

const router = Router();

// Org-admin (or platform-admin) only.
router.use(requireOrgRole(["org_admin", "platform_admin"]));

router.get("/", c.get);
router.put("/", validate(updateBotConfigValidator), c.update);
router.post("/enable", validate(enableBotValidator), c.enable);
router.post("/disable", c.disable);
// The webhook switch, separate from the bot: connected + AI off = live inbox
// updates with no automated replies.
router.post("/webhook", c.connectWebhook);
router.delete("/webhook", c.disconnectWebhook);
router.put("/mode", validate(setModeValidator), c.setMode);

export default router;
