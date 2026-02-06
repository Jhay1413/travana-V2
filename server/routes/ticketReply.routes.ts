import { Router } from "express";
import { ticketReplyController } from "../controllers/ticketReply.controller";
import { validate } from "../middlewares/validation.middleware";
import { createTicketReplyValidator } from "../validators/ticket.validator";

const router = Router();

router.get("/ticket/:ticketId", ticketReplyController.listByTicketId);
router.post("/ticket/:ticketId", validate(createTicketReplyValidator), ticketReplyController.createReply);
router.put("/:id", ticketReplyController.updateReply);
router.delete("/:id", ticketReplyController.deleteReply);

export default router;
