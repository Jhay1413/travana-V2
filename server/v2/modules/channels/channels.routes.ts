import { Router } from "express";
import { validate } from "../../middlewares/validation.middleware";
import { channelsController as c } from "./channels.controller";
import { connectTokenValidator, delegateConnectValidator } from "./channels.validator";

const router = Router();

// Static paths before the /:channelId param.
router.get("/", c.list);
router.get("/types", c.types);
router.get("/status", c.status);
router.get("/health", c.health);
router.post("/connect-token", validate(connectTokenValidator), c.createConnectToken);
router.post("/connect-token/delegate", validate(delegateConnectValidator), c.delegateConnect);
router.get("/whatsapp/:channelId/status", c.whatsappStatus);
router.delete("/:channelId", c.remove);

export default router;
