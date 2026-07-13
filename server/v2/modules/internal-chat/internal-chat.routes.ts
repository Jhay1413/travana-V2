import { Router } from "express";
import { validate } from "../../middlewares/validation.middleware";
import { internalChatController as c } from "./internal-chat.controller";
import { createSessionValidator, postMessageValidator, listMessagesValidator } from "./internal-chat.validator";

const router = Router();

// No requireOrgRole here: `assistant` sessions are open to any authenticated
// org member; the `test_flow` role gate depends on the request body (`mode`)
// and is enforced in the controller/service instead (see
// internal-chat.service.ts createSession).

router.post("/sessions", validate(createSessionValidator), c.createSession);
router.post("/sessions/:id/messages", validate(postMessageValidator), c.postMessage);
router.get("/sessions/:id/messages", validate(listMessagesValidator), c.listMessages);

export default router;
