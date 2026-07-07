import { Router } from "express";
import { channelsController as c } from "./channels.controller";

const router = Router();

// Static paths before the /:channelId param.
router.get("/", c.list);
router.get("/types", c.types);
router.post("/connect-token", c.createConnectToken);
router.get("/whatsapp/:channelId/status", c.whatsappStatus);
router.delete("/:channelId", c.remove);

export default router;
