import { Router } from "express";
import { ticketController } from "./ticket.controller";
import { validate } from "../../middlewares/validation.middleware";
import { createTicketValidator, updateTicketValidator, ticketIdValidator } from "./ticket.validator";

const router = Router();

router.get("/", ticketController.listTickets);
router.get("/:id", ticketController.getTicketById);
router.get("/client/:clientId", ticketController.listTicketsByClient);
router.get("/user/:userId", ticketController.listTicketsByUser);
router.post("/", validate(createTicketValidator), ticketController.createTicket);
router.post("/:id/like", validate(ticketIdValidator), ticketController.toggleLike);
router.patch("/:id", validate(updateTicketValidator), ticketController.updateTicket);
router.delete("/:id", ticketController.deleteTicket);

export default router;
