import { Router } from "express";
import { validate } from "../../middlewares/validation.middleware";
import { conversationsController as c } from "./conversations.controller";
import { conversationIdParamValidator } from "./conversations.validator";

const router = Router();

// ── Collection-level (static paths first, before the /:conversation_id param) ──
router.get("/", c.list);
router.post("/", c.create);
router.get("/badge-counts", c.badgeCounts);
router.post("/bulk-close", c.bulkClose);
router.get("/analytics/trending-tags", c.trendingTags);
router.post("/search-similar", c.searchSimilar);
router.post("/initiate", c.initiate);
router.post("/check-existing", c.checkExisting);
router.post("/open-or-create", c.openOrCreate);

// ── Single conversation ──
router.get("/:conversation_id", c.getById);
router.patch("/:conversation_id", c.update);
router.post("/:conversation_id/assign/:user_id", c.assign);
router.post("/:conversation_id/close", c.close);
router.post("/:conversation_id/reopen", c.reopen);
router.post("/:conversation_id/snooze", c.snooze);
router.delete("/:conversation_id/snooze", c.unsnooze);
router.post("/:conversation_id/merge", c.merge);
router.post("/:conversation_id/summarize", c.summarize);
router.get("/:conversation_id/summary", c.summary);
router.get("/:conversation_id/previous", c.previous);
router.post("/:conversation_id/transcript", c.transcriptExport);
router.get("/:conversation_id/transcript/:job_id", c.transcriptStatus);
router.get("/:conversation_id/switchable-channels", c.switchableChannels);
router.get("/:conversation_id/sender-options", c.senderOptions);
router.post("/:conversation_id/switch-channel", c.switchChannel);
router.get("/:conversation_id/bot-session", c.botSession);
router.get("/:conversation_id/available-bots", c.availableBots);
router.post("/:conversation_id/bot-session/enable", c.botEnable);
router.post("/:conversation_id/bot-session/disable", c.botDisable);

// Our own per-conversation AI auto-reply enable/disable/status (sendseven-webhook
// module's conversation state) — distinct from bot-session above, which proxies
// SendSeven's native bots.
router.get("/:conversation_id/ai-state", validate(conversationIdParamValidator), c.aiState);
router.post("/:conversation_id/ai-state/enable", validate(conversationIdParamValidator), c.aiEnable);
router.post("/:conversation_id/ai-state/disable", validate(conversationIdParamValidator), c.aiDisable);

export default router;
