import { Router } from "express";
import { bookingController } from "../controllers/booking.controller";
import { tagService } from "../services/tag.service";
import { asyncHandler } from "../utils/async-handler";
import { successResponse } from "../utils/response";

const router = Router();

router.get("/", bookingController.listBookings);
router.get("/:id", bookingController.getBookingById);
router.get("/transaction/:transactionId", bookingController.getBookingByTransactionId);
router.post("/convert/:quoteId", bookingController.convertQuoteToBooking);
router.post("/", bookingController.createBooking);
router.patch("/:id", bookingController.updateBooking);
router.delete("/:id", bookingController.deleteBooking);

router.post("/:id/flights", bookingController.addFlight);
router.delete("/:id/flights/:flightId", bookingController.removeFlight);
router.post("/:id/accommodations", bookingController.addAccommodation);
router.delete("/:id/accommodations/:accommodationId", bookingController.removeAccommodation);

router.put("/:id/tags", asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { tags } = req.body;
  if (!Array.isArray(tags)) {
    return res.status(400).json({ error: "tags must be an array of tag names" });
  }
  await tagService.updateBookingTags(id, tags);
  const updated = await tagService.getBookingTags(id);
  return successResponse(res, updated, "Booking tags updated");
}));

router.get("/:id/tags", asyncHandler(async (req, res) => {
  const tags = await tagService.getBookingTags(req.params.id);
  return successResponse(res, tags, "Booking tags retrieved");
}));

export default router;
