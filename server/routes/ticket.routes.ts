import { Router } from "express";
import { ticketController } from "../controllers/ticket.controller";
import { validate } from "../middlewares/validation.middleware";
import { createTicketValidator, updateTicketValidator } from "../validators/ticket.validator";

const router = Router();

router.get("/", ticketController.listTickets);
router.get("/:id", ticketController.getTicketById);
router.get("/client/:clientId", ticketController.listTicketsByClient);
router.get("/user/:userId", ticketController.listTicketsByUser);
router.post("/", validate(createTicketValidator), ticketController.createTicket);
router.patch("/:id", validate(updateTicketValidator), ticketController.updateTicket);
router.delete("/:id", ticketController.deleteTicket);

export default router;
