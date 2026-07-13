import { Router } from "express";
import { sendsevenWebhookController } from "./sendseven-webhook.controller";

// PUBLIC receiver — SendSeven is unauthenticated to us; the signature is the
// auth. Mounted OUTSIDE the app's auth chain. `orgId` in the path selects which
// org's secret to verify against before any body content is trusted.
const router = Router();

router.post("/:orgId", sendsevenWebhookController.receive);

export default router;
