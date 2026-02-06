import { Router } from "express";
import userRoutes from "./user.routes";
import clientRoutes from "./client.routes";
import quoteRoutes from "./quote.routes";
import accommodationRoutes from "./accommodation.routes";
import flightRoutes from "./flight.routes";
import commissionRoutes from "./commission.routes";
import quoteImageRoutes from "./quoteImage.routes";
import noteRoutes from "./note.routes";
import tourOperatorRoutes from "./tourOperator.routes";
import airportRoutes from "./airport.routes";
import ticketRoutes from "./ticket.routes";
import ticketAttachmentRoutes from "./ticketAttachment.routes";
import ticketReplyRoutes from "./ticketReply.routes";
import notificationRoutes from "./notification.routes";
import neonClientRoutes from "./neonClient.routes";
import dashboardRoutes from "./dashboard.routes";

const router = Router();

router.use("/users", userRoutes);
router.use("/clients", clientRoutes);
router.use("/quotes", quoteRoutes);
router.use("/accommodations", accommodationRoutes);
router.use("/flights", flightRoutes);
router.use("/commissions", commissionRoutes);
router.use("/quote-images", quoteImageRoutes);
router.use("/notes", noteRoutes);
router.use("/tour-operators", tourOperatorRoutes);
router.use("/airports", airportRoutes);
router.use("/tickets", ticketRoutes);
router.use("/attachments", ticketAttachmentRoutes);
router.use("/replies", ticketReplyRoutes);
router.use("/notifications", notificationRoutes);
router.use("/neon-clients", neonClientRoutes);
router.use("/dashboard", dashboardRoutes);

export default router;
