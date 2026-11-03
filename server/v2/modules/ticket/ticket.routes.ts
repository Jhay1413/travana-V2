import { Router } from "express";
import { ticketController } from "./ticket.controller";
import { validate } from "../../middlewares/validation.middleware";
import { createTicketValidator, updateTicketValidator, ticketIdValidator, listTicketsValidator } from "./ticket.validator";
import { blockReadOnlyClientWrites } from '../../middlewares/auth/block-read-only-roles';

const router = Router();
// social_media_manager is read-only on client data: refuse every write method.
router.use(blockReadOnlyClientWrites);

router.get("/", validate(listTicketsValidator), ticketController.listTickets);
router.get("/:id", ticketController.getTicketById);
router.get("/client/:clientId", ticketController.listTicketsByClient);
router.get("/user/:userId", ticketController.listTicketsByUser);
router.post("/", validate(createTicketValidator), ticketController.createTicket);
router.post("/:id/like", validate(ticketIdValidator), ticketController.toggleLike);
router.patch("/:id", validate(updateTicketValidator), ticketController.updateTicket);
router.delete("/:id", ticketController.deleteTicket);

export default router;
