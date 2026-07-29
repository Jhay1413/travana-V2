import { Router } from "express";
import multer from "multer";
import { bookingController } from "./booking.controller";
import { bookingImageController } from "./booking-image.controller";
import { bookingUpsellController } from "./booking-upsell.controller";
import { validate } from "../../middlewares/validation.middleware";
import { addImagesValidator, reorderImagesValidator } from "./booking.validator";
import { createUpsellValidator, listUpsellsValidator } from "./booking-upsell.validator";

const router = Router();
const ALLOWED_MIME_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (ALLOWED_MIME_TYPES.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error(`File type ${file.mimetype} not allowed. Only JPEG, PNG, WebP and GIF are accepted.`));
    }
  },
});

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

router.post("/:bookingId/images/upload", upload.array("images", 50), bookingImageController.uploadImages);
router.post("/:bookingId/images", validate(addImagesValidator), bookingImageController.addImages);
router.get("/:bookingId/images", bookingImageController.getImages);
router.delete("/:bookingId/images/:imageId", bookingImageController.deleteImage);
router.patch("/:bookingId/images/order", validate(reorderImagesValidator), bookingImageController.reorderImages);
router.patch("/:bookingId/images/:imageId/primary", bookingImageController.setPrimaryImage);

router.get("/:bookingId/upsells", validate(listUpsellsValidator), bookingUpsellController.list);
router.post("/:bookingId/upsells", validate(createUpsellValidator), bookingUpsellController.create);

router.put("/:id/tags", bookingController.updateBookingTags);
router.get("/:id/tags", bookingController.getBookingTags);

export default router;
