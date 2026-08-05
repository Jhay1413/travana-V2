import { Router } from "express";
import { validate } from "../../middlewares/validation.middleware";
import { chatAttachmentUpload, internalChatController as c } from "./internal-chat.controller";
import { createSessionValidator, forkSessionValidator, postMessageValidator, listMessagesValidator } from "./internal-chat.validator";

const router = Router();

// No requireOrgRole here: `assistant` sessions are open to any authenticated
// org member; the `test_flow` role gate depends on the request body (`mode`)
// and is enforced in the controller/service instead (see
// internal-chat.service.ts createSession).

router.post("/sessions", validate(createSessionValidator), c.createSession);
// Fork a real SendSeven conversation into a sandboxed test_flow session
// (role-gated in the service, like test_flow session creation).
router.post("/sessions/fork-from-conversation", validate(forkSessionValidator), c.forkFromConversation);
// chatAttachmentUpload only engages on multipart requests (test-flow image
// attachments) — plain JSON messages pass straight through it unchanged.
router.post("/sessions/:id/messages", chatAttachmentUpload.array("attachments", 3), validate(postMessageValidator), c.postMessage);
router.get("/sessions/:id/messages", validate(listMessagesValidator), c.listMessages);

export default router;
