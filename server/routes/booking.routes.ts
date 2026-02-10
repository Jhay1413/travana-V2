import { Router } from "express";
import { bookingController } from "../controllers/booking.controller";

const router = Router();

router.get("/", bookingController.listBookings);
router.get("/:id", bookingController.getBookingById);
router.get("/transaction/:transactionId", bookingController.getBookingByTransactionId);
router.post("/convert/:quoteId", bookingController.convertQuoteToBooking);
router.post("/", bookingController.createBooking);
router.patch("/:id", bookingController.updateBooking);
router.delete("/:id", bookingController.deleteBooking);

export default router;
