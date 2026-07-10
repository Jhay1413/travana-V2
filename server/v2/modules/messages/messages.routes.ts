import { Router } from "express";
import { messagesController as m } from "./messages.controller";

const router = Router();

// Static paths before the /:message_id param.
router.get("/", m.list);
router.post("/", m.send);
router.post("/internal-notes", m.createInternalNote);
router.get("/mention-users", m.mentionUsers);
router.get("/attachments/:attachment_id/download", m.downloadAttachment);

router.get("/:message_id", m.getById);
router.post("/:message_id/react", m.react);
router.delete("/:message_id/react", m.removeReaction);
router.post("/:message_id/translate", m.translate);

export default router;
