import { Router } from "express";
import { ticketController } from "./ticket.controller";

const router = Router();

router.get("/", ticketController.listTickets);
router.get("/:id", ticketController.getTicketById);
router.get("/client/:clientId", ticketController.listTicketsByClient);
router.get("/user/:userId", ticketController.listTicketsByUser);
router.post("/", ticketController.createTicket);
router.patch("/:id", ticketController.updateTicket);
router.delete("/:id", ticketController.deleteTicket);

export default router;
